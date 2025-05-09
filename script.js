document.addEventListener('DOMContentLoaded', function () {
    // DOM Elements
    const elements = {
        calendar: document.getElementById('calendar'),
        monthSelector: document.getElementById('monthSelector'),
        enterBtn: document.getElementById('enterBtn'),
        eventList: document.getElementById('eventList'),
        intEnterBtn: document.getElementById('intEnterBtn'),
        interpreterList: document.getElementById('interpreterList'),
        inputs: {
            showName: document.getElementById('showName'),
            location: document.getElementById('location'),
            startDate: document.getElementById('startDate'),
            endDate: document.getElementById('endDate'),
            interpreters: document.getElementById('interpreters')
        },
        intInputs: {
            name: document.getElementById('intName'),
            fullName: document.getElementById('intFullName'),
            idName: document.getElementById('intIdName')
        }
    };

    // State
    let events = [];
    let selectedEvents = [];
    let interpreters = [];
    let editingInterpreterId = null;
    let selectingAssignedFor = null; // Tracks SEA edit mode
    let assigningInterpreter = null; // Tracks assigning mode
    let interpreterAssignments = {}; // Tracks working days: { interpreterId: { date: boolean } }

    // Initialize FullCalendar
    const calendar = new FullCalendar.Calendar(elements.calendar, {
        initialView: 'dayGridMonth',
        events: [],
        eventClick: function (info) {
            const eventId = info.event.id;
            const isSelected = selectedEvents.includes(eventId);

            if (isSelected) {
                // Deselect event
                selectedEvents = selectedEvents.filter(id => id !== eventId);
                const event = events.find(e => e.id === eventId);
                event.classNames = getEventClassNames(event);
                const calEvent = calendar.getEventById(eventId);
                calEvent.remove();
                calendar.addEvent(event);
                selectingAssignedFor = null;
                assigningInterpreter = null;
                resetTickBoxes();
            } else {
                // Select event
                selectedEvents.push(eventId);
                info.event.setProp('classNames', ['selected']);
                assigningInterpreter = null;
                resetTickBoxes();
            }

            renderSelectedEvents();
            renderInterpreters();
            calendar.render();
        },
        dayCellClassNames: function (info) {
            const classes = [];
            const date = new Date(info.date.getFullYear(), info.date.getMonth(), info.date.getDate());
            date.setHours(0, 0, 0, 0);
            const dateStr = date.toISOString().split('T')[0];

            // Highlight event duration in SEA edit mode
            if (selectingAssignedFor) {
                const event = events.find(e => e.id === selectingAssignedFor.eventId);
                if (event) {
                    const start = new Date(event.start);
                    start.setHours(0, 0, 0, 0);
                    const end = new Date(event.end || event.start);
                    end.setHours(0, 0, 0, 0);
                    if (date >= start && date < end) {
                        classes.push('interpreter-assigned');
                    }
                }
            }

            // Highlight assigned event dates and working days in assigning mode
            if (assigningInterpreter) {
                let assignmentCount = 0;
                events.forEach(event => {
                    if (event.assigned.split(', ').filter(n => n).includes(assigningInterpreter.name)) {
                        const start = new Date(event.start);
                        start.setHours(0, 0, 0, 0);
                        const end = new Date(event.end || event.start);
                        end.setHours(0, 0, 0, 0);
                        if (date >= start && date < end) {
                            assignmentCount++;
                        }
                    }
                });

                // Apply highlight based on number of assignments
                if (assignmentCount >= 2) {
                    classes.push('interpreter-overlap');
                } else if (assignmentCount === 1) {
                    classes.push('interpreter-assigned');
                }

                // Highlight working days
                const assignments = interpreterAssignments[assigningInterpreter.id] || {};
                if (assignments[dateStr]) {
                    classes.push('working-day');
                }
            }

            return classes;
        },
        dayCellDidMount: function (info) {
            const dateStr = info.date.toISOString().split('T')[0];
            const topElement = info.el.querySelector('.fc-daygrid-day-top');
            if (topElement) {
                const tickbox = document.createElement('input');
                tickbox.type = 'checkbox';
                tickbox.className = 'date-tickbox';
                tickbox.id = `tickbox-${dateStr}`;
                tickbox.checked = false; // Default to unticked
                topElement.appendChild(tickbox);

                // Tick box handler for assigning mode
                tickbox.addEventListener('change', () => {
                    if (assigningInterpreter) {
                        const interpreterId = assigningInterpreter.id;
                        if (!interpreterAssignments[interpreterId]) {
                            interpreterAssignments[interpreterId] = {};
                        }
                        interpreterAssignments[interpreterId][dateStr] = tickbox.checked;
                        calendar.render(); // Update working-day highlight
                    }
                });

                // Initialize checked state for assigning mode
                if (assigningInterpreter) {
                    const assignments = interpreterAssignments[assigningInterpreter.id] || {};
                    tickbox.checked = !!assignments[dateStr];
                }
            }
        },
        eventContent: function (arg) {
            return { html: `<div>${arg.event.title}</div>` };
        }
    });
    calendar.render();

    // Reset tick boxes and clear working-day highlights
    function resetTickBoxes() {
        if (assigningInterpreter) {
            const interpreterId = assigningInterpreter.id;
            interpreterAssignments[interpreterId] = {};
        }
        document.querySelectorAll('.date-tickbox').forEach(tickbox => {
            tickbox.checked = false;
        });
        calendar.render();
    }

    // Month selector
    elements.monthSelector.addEventListener('change', function () {
        const month = parseInt(this.value);
        calendar.gotoDate(new Date(calendar.getDate().getFullYear(), month, 1));
        calendar.render();
    });

    elements.monthSelector.value = new Date().getMonth();

    // Add event
    elements.enterBtn.addEventListener('click', function () {
        const startDate = elements.inputs.startDate.value;
        const endDate = elements.inputs.endDate.value || startDate;
        const event = {
            id: Date.now().toString(),
            title: elements.inputs.showName.value || 'Untitled',
            start: startDate,
            end: new Date(new Date(endDate).setDate(new Date(endDate).getDate() + 1)).toISOString().split('T')[0],
            location: elements.inputs.location.value,
            interpreters: elements.inputs.interpreters.value || '0',
            assigned: ''
        };

        if (!event.start || !event.title) {
            alert('Please enter Show Name and Start Date.');
            return;
        }

        event.classNames = getEventClassNames(event);
        events.push(event);
        calendar.addEvent(event);

        Object.values(elements.inputs).forEach(input => input.value = '');
        elements.inputs.location.value = 'Hong Kong';
        elements.inputs.interpreters.value = '';

        calendar.render();
    });

    // Get event class names
    function getEventClassNames(event) {
        if (selectedEvents.includes(event.id)) return ['selected'];

        const interpreters = parseInt(event.interpreters) || 0;
        const assignedCount = event.assigned ? event.assigned.split(', ').filter(n => n).length : 0;
        if (interpreters - assignedCount === 0 && event.assigned) {
            return [event.location === 'Hong Kong' ? 'fully-assigned-hong-kong' : 'fully-assigned-macau'];
        }
        return [event.location.toLowerCase()];
    }

    // Render selected events (SEA)
    function renderSelectedEvents() {
        elements.eventList.innerHTML = '';
        selectedEvents.forEach(eventId => {
            const event = events.find(e => e.id === eventId);
            if (!event) return;

            const interpreters = parseInt(event.interpreters) || 0;
            const assignedCount = event.assigned ? event.assigned.split(', ').filter(n => n).length : 0;
            const interpretersLeft = interpreters - assignedCount;

            const row = document.createElement('div');
            row.className = 'event-row';
            row.dataset.id = eventId;
            row.innerHTML = `
        <input type="text" data-field="title" value="${event.title}" class="p-2 border rounded w-32">
        <select data-field="location" class="p-2 border rounded w-32">
          <option value="Hong Kong" ${event.location === 'Hong Kong' ? 'selected' : ''}>Hong Kong</option>
          <option value="Macau" ${event.location === 'Macau' ? 'selected' : ''}>Macau</option>
        </select>
        <input type="date" data-field="start" value="${event.start}" class="p-2 border rounded w-32">
        <input type="date" data-field="end" value="${event.end ? new Date(new Date(event.end).setDate(new Date(event.end).getDate() - 1)).toISOString().split('T')[0] : ''}" class="p-2 border rounded w-32">
        <input type="number" data-field="interpreters" value="${event.interpreters}" min="0" class="p-2 border rounded w-32">
        <input type="number" data-field="interpretersLeft" value="${interpretersLeft}" class="p-2 border rounded w-32" readonly>
        <input type="text" data-field="assigned" value="${event.assigned}" class="p-2 border rounded ${selectingAssignedFor && selectingAssignedFor.eventId === eventId ? 'editing' : ''}" ${selectingAssignedFor && selectingAssignedFor.eventId === eventId ? '' : 'readonly'}>
        <button class="delete-icon" title="Delete Event">🗑️</button>
      `;

            const inputs = row.querySelectorAll('input:not([data-field="interpreters"],[data-field="interpretersLeft"],[data-field="assigned"]), select');
            inputs.forEach(input => {
                input.addEventListener('input', () => {
                    event.title = row.querySelector('input[data-field="title"]').value || 'Untitled';
                    event.location = row.querySelector('select[data-field="location"]').value;
                    event.start = row.querySelector('input[data-field="start"]').value;
                    const endInput = row.querySelector('input[data-field="end"]').value;
                    event.end = endInput ? new Date(new Date(endInput).setDate(new Date(endInput).getDate() + 1)).toISOString().split('T')[0] : event.start;

                    const calEvent = calendar.getEventById(eventId);
                    if (calEvent) {
                        calEvent.remove();
                        event.classNames = getEventClassNames(event);
                        calendar.addEvent(event);
                    }

                    renderSelectedEvents();
                    calendar.render();
                });
            });

            const interpretersInput = row.querySelector('input[data-field="interpreters"]');
            interpretersInput.addEventListener('input', () => {
                event.interpreters = interpretersInput.value || '0';
                const interpreters = parseInt(event.interpreters) || 0;
                const assignedCount = event.assigned ? event.assigned.split(', ').filter(n => n).length : 0;
                row.querySelector('input[data-field="interpretersLeft"]').value = interpreters - assignedCount;

                const calEvent = calendar.getEventById(eventId);
                if (calEvent) {
                    calEvent.remove();
                    event.classNames = getEventClassNames(event);
                    calendar.addEvent(event);
                }

                renderSelectedEvents();
                calendar.render();
            });

            const assignedInput = row.querySelector('input[data-field="assigned"]');
            assignedInput.addEventListener('click', () => {
                if (selectingAssignedFor && selectingAssignedFor.eventId === eventId) {
                    selectingAssignedFor = null;
                    assignedInput.readOnly = true;
                    assignedInput.classList.remove('editing');
                } else {
                    selectingAssignedFor = { eventId, input: assignedInput };
                    assignedInput.readOnly = false;
                    assignedInput.classList.add('editing');
                    assigningInterpreter = null;
                    resetTickBoxes();
                }
                renderSelectedEvents();
                renderInterpreters();
                calendar.render();
            });

            assignedInput.addEventListener('input', () => {
                event.assigned = assignedInput.value;
                const interpreters = parseInt(event.interpreters) || 0;
                const assignedCount = event.assigned ? event.assigned.split(', ').filter(n => n).length : 0;
                row.querySelector('input[data-field="interpretersLeft"]').value = interpreters - assignedCount;

                const calEvent = calendar.getEventById(eventId);
                if (calEvent) {
                    calEvent.remove();
                    event.classNames = getEventClassNames(event);
                    calendar.addEvent(event);
                }

                renderSelectedEvents();
                renderInterpreters();
                calendar.render();
            });

            const deleteButton = row.querySelector('.delete-icon');
            deleteButton.addEventListener('click', () => {
                events = events.filter(e => e.id !== eventId);
                const calEvent = calendar.getEventById(eventId);
                if (calEvent) {
                    calEvent.remove();
                }
                selectedEvents = selectedEvents.filter(id => id !== eventId);
                if (selectingAssignedFor && selectingAssignedFor.eventId === eventId) {
                    selectingAssignedFor = null;
                }
                assigningInterpreter = null;
                resetTickBoxes();
                renderSelectedEvents();
                renderInterpreters();
                calendar.render();
            });

            elements.eventList.appendChild(row);
        });
    }

    // Add interpreter
    elements.intEnterBtn.addEventListener('click', function () {
        const interpreter = {
            id: editingInterpreterId || Date.now().toString(),
            name: elements.intInputs.name.value || 'Unnamed',
            fullName: elements.intInputs.fullName.value || 'Unnamed',
            idName: elements.intInputs.idName.value || 'None'
        };

        const existingIndex = interpreters.findIndex(i => i.id === interpreter.id);
        if (existingIndex !== -1) {
            interpreters[existingIndex] = interpreter;
        } else {
            interpreters.push(interpreter);
        }

        Object.values(elements.intInputs).forEach(input => input.value = '');
        editingInterpreterId = null;

        renderInterpreters();
        calendar.render();
    });

    // Render interpreters
    function renderInterpreters() {
        elements.interpreterList.innerHTML = '';
        interpreters.forEach(interpreter => {
            const row = document.createElement('tr');
            row.dataset.id = interpreter.id;

            const isSelected = selectingAssignedFor && events.find(e => e.id === selectingAssignedFor.eventId)?.assigned.split(', ').filter(n => n).includes(interpreter.name);
            const isAssigned = assigningInterpreter && assigningInterpreter.name === interpreter.name;

            row.className = isSelected ? 'selected' : isAssigned ? 'interpreter-assigned' : '';
            row.innerHTML = `
        <td>${interpreter.name}</td>
        <td>${interpreter.fullName}</td>
        <td>${interpreter.idName}</td>
      `;

            row.addEventListener('click', () => {
                if (selectingAssignedFor) {
                    // SEA edit mode: Add/remove interpreter from Assigned
                    const names = selectingAssignedFor.input.value ? selectingAssignedFor.input.value.split(', ').filter(n => n) : [];
                    const index = names.indexOf(interpreter.name);
                    if (index === -1) {
                        names.push(interpreter.name);
                    } else {
                        names.splice(index, 1);
                    }
                    selectingAssignedFor.input.value = names.join(', ');

                    const event = events.find(e => e.id === selectingAssignedFor.eventId);
                    if (event) {
                        event.assigned = selectingAssignedFor.input.value;
                        const interpreters = parseInt(event.interpreters) || 0;
                        const assignedCount = event.assigned ? event.assigned.split(', ').filter(n => n).length : 0;
                        const eventRow = document.querySelector(`.event-row[data-id="${selectingAssignedFor.eventId}"]`);
                        if (eventRow) {
                            eventRow.querySelector('input[data-field="interpretersLeft"]').value = interpreters - assignedCount;
                        }

                        const calEvent = calendar.getEventById(selectingAssignedFor.eventId);
                        if (calEvent) {
                            calEvent.remove();
                            event.classNames = getEventClassNames(event);
                            calendar.addEvent(event);
                        }
                    }

                    renderSelectedEvents();
                    renderInterpreters();
                    calendar.render();
                } else {
                    // Toggle assigning mode
                    if (isAssigned) {
                        assigningInterpreter = null;
                        resetTickBoxes();
                    } else {
                        assigningInterpreter = { id: interpreter.id, name: interpreter.name };
                        elements.intInputs.name.value = interpreter.name;
                        elements.intInputs.fullName.value = interpreter.fullName;
                        elements.intInputs.idName.value = interpreter.idName;
                        editingInterpreterId = interpreter.id;
                    }
                    renderInterpreters();
                    calendar.render();
                }
            });

            elements.interpreterList.appendChild(row);
        });
    }
});