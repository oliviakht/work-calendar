document.addEventListener('DOMContentLoaded', function () {
    // --- Firebase Setup ---
    const firebaseConfig = {
        apiKey: "AIzaSyBhkRkIeGLYdqRKeRpOVM3uPq_a3DVOrkM",
        authDomain: "work-calendar-d297e.firebaseapp.com",
        projectId: "work-calendar-d297e",
        storageBucket: "work-calendar-d297e.firebasestorage.app",
        messagingSenderId: "311327386503",
        appId: "1:311327386503:web:df74219603be05be5f4122",
        measurementId: "G-M0BF6GVZZ0"
    };

    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    // --- Firestore Storage Functions ---
    async function saveEventsToFirestore(events) {
        await db.collection('calendar').doc('events').set({ events });
    }

    async function loadEventsFromFirestore() {
        const doc = await db.collection('calendar').doc('events').get();
        return doc.exists ? doc.data().events : [];
    }

    async function saveInterpretersToFirestore(interpreters) {
        await db.collection('calendar').doc('interpreters').set({ interpreters });
    }

    async function loadInterpretersFromFirestore() {
        const doc = await db.collection('calendar').doc('interpreters').get();
        return doc.exists ? doc.data().interpreters : [];
    }

    async function saveAssignmentsToFirestore(interpreterId, assignments) {
        let allAssignments = await loadAssignmentsFromFirestore();
        allAssignments[interpreterId] = assignments;
        await db.collection('calendar').doc('assignments').set(allAssignments);
    }

    async function loadAssignmentsFromFirestore() {
        const doc = await db.collection('calendar').doc('assignments').get();
        return doc.exists ? doc.data() : {};
    }

    // --- DOM Elements ---
    const elements = {
        calendar: document.getElementById('calendar'),
        monthSelector: document.getElementById('monthSelector'),
        prevMonth: document.getElementById('prevMonth'),
        nextMonth: document.getElementById('nextMonth'),
        todayBtn: document.getElementById('todayBtn'),
        enterBtn: document.getElementById('enterBtn'),
        eventList: document.getElementById('eventList'),
        exitAllBtn: document.getElementById('exitAllBtn'),
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
            gender: document.getElementById('intGender'),
            idName: document.getElementById('intIdName')
        }
    };

    // --- State ---
    let events = [];
    let selectedEvents = [];
    let interpreters = [];
    let editingInterpreterId = null;
    let assigningInterpreter = null;
    let interpreterAssignments = {};

    // --- FullCalendar ---
    const calendar = new FullCalendar.Calendar(elements.calendar, {
        initialView: 'dayGridMonth',
        headerToolbar: { left: '', center: '', right: '' }, // Disable default header
        events: [],
        eventClick: function (info) {
            const eventId = info.event.id;
            const isSelected = selectedEvents.includes(eventId);

            if (isSelected) {
                selectedEvents = selectedEvents.filter(id => id !== eventId);
                const event = events.find(e => e.id === eventId);
                if (event) {
                    event.classNames = getEventClassNames(event);
                    const calEvent = calendar.getEventById(eventId);
                    calEvent.remove();
                    calendar.addEvent(event);
                }
                updateTickBoxes(); // Keep tickboxes updated, but don't exit assigning mode
            } else {
                selectedEvents.push(eventId);
                info.event.setProp('classNames', ['selected']);
                updateTickBoxes(); // Keep tickboxes updated, but don't exit assigning mode
            }

            renderSelectedEvents();
            renderInterpreters();
            calendar.render();
        },
        dayCellClassNames: function (info) {
            const classes = [];
            if (!assigningInterpreter) {
                return classes;
            }

            // Safety check: Ensure info.el exists before accessing getAttribute
            if (!info.el) {
                return classes;
            }

            const dateStr = info.el.getAttribute('data-date');
            if (!dateStr) {
                return classes;
            }

            const assignments = interpreterAssignments[assigningInterpreter.id] || {};
            if (assignments[dateStr]) {
                classes.push('interpreter-working');
                return classes;
            }

            let eventCount = 0;
            events.forEach(event => {
                const startStr = event.start.split('T')[0];
                const endStr = event.end ? event.end.split('T')[0] : startStr;
                if ((event.interpreterIds || []).includes(assigningInterpreter.id)) {
                    if (dateStr >= startStr && dateStr < endStr) {
                        eventCount++;
                    }
                }
            });

            if (eventCount >= 2) {
                classes.push('interpreter-overlap');
            } else if (eventCount === 1) {
                classes.push('interpreter-assigned');
            }

            return classes;
        },
        dayCellDidMount: function (info) {
            const dateStr = info.el.getAttribute('data-date');
            const topElement = info.el.querySelector('.fc-daygrid-day-top');

            if (topElement) {
                let tickbox = topElement.querySelector(`#tickbox-${dateStr}`);
                if (!tickbox) {
                    tickbox = document.createElement('input');
                    tickbox.type = 'checkbox';
                    tickbox.className = 'date-tickbox';
                    tickbox.id = `tickbox-${dateStr}`;
                    topElement.appendChild(tickbox);
                }

                tickbox.disabled = !assigningInterpreter;
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

    document.addEventListener('change', function (event) {
        if (event.target.classList.contains('date-tickbox')) {
            const tickbox = event.target;
            const dateStr = tickbox.id.replace('tickbox-', '');
            if (!assigningInterpreter) {
                return;
            }

            const interpreterId = assigningInterpreter.id;
            if (!interpreterAssignments[interpreterId]) {
                interpreterAssignments[interpreterId] = {};
            }
            interpreterAssignments[interpreterId][dateStr] = tickbox.checked;
            saveAssignmentsToFirestore(interpreterId, interpreterAssignments[interpreterId]).then(() => {
                document.querySelectorAll('.fc-daygrid-day').forEach(cell => {
                    const cellDateStr = cell.getAttribute('data-date');
                    if (!cellDateStr || !assigningInterpreter) {
                        cell.classList.remove('interpreter-assigned', 'interpreter-overlap', 'interpreter-working');
                        return;
                    }
                    if (cellDateStr === dateStr) {
                        cell.classList.remove('interpreter-assigned', 'interpreter-overlap', 'interpreter-working');
                        if (tickbox.checked) {
                            cell.classList.add('interpreter-working');
                        } else {
                            let eventCount = 0;
                            events.forEach(event => {
                                if ((event.interpreterIds || []).includes(assigningInterpreter.id)) {
                                    const start = new Date(event.start.split('T')[0]);
                                    const end = new Date((event.end || event.start).split('T')[0]);
                                    const current = new Date(cellDateStr);
                                    if (current >= start && current < end) eventCount++;
                                }
                            });
                            if (eventCount >= 2) cell.classList.add('interpreter-overlap');
                            else if (eventCount === 1) cell.classList.add('interpreter-assigned');
                        }
                    }
                });

                calendar.render();
            });
        }
    });

    function updateTickBoxes() {
        document.querySelectorAll('.date-tickbox').forEach(tickbox => {
            const dateStr = tickbox.id.replace('tickbox-', '');
            tickbox.disabled = !assigningInterpreter;
            if (assigningInterpreter) {
                const assignments = interpreterAssignments[assigningInterpreter.id] || {};
                tickbox.checked = !!assignments[dateStr];
            } else {
                tickbox.checked = false; // Untick when not in assigning mode
            }
        });
        calendar.render();
    }

    function updateMonthSelector() {
        const currentDate = calendar.getDate();
        elements.monthSelector.value = currentDate.getMonth();
    }

    elements.monthSelector.addEventListener('change', function () {
        const month = parseInt(this.value);
        const currentDate = calendar.getDate();
        calendar.gotoDate(new Date(currentDate.getFullYear(), month, 1));
        calendar.render();
    });

    elements.prevMonth.addEventListener('click', function () {
        calendar.prev();
        updateMonthSelector();
        calendar.render();
    });

    elements.nextMonth.addEventListener('click', function () {
        calendar.next();
        updateMonthSelector();
        calendar.render();
    });

    elements.todayBtn.addEventListener('click', function () {
        calendar.today();
        updateMonthSelector();
        calendar.render();
    });

    elements.monthSelector.value = new Date().getMonth();

    elements.enterBtn.addEventListener('click', async function () {
        const startDate = elements.inputs.startDate.value;
        const endDate = elements.inputs.endDate.value || startDate;
        const event = {
            id: Date.now().toString(),
            title: elements.inputs.showName.value || 'Untitled',
            start: startDate,
            end: new Date(new Date(endDate).setDate(new Date(endDate).getDate() + 1)).toISOString().split('T')[0],
            location: elements.inputs.location.value,
            interpreters: elements.inputs.interpreters.value || '0',
            interpreterIds: []
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

        await saveEventsToFirestore(events);
        calendar.render();
    });

    function getEventClassNames(event) {
        if (selectedEvents.includes(event.id)) return ['selected'];
        const interpretersNeeded = parseInt(event.interpreters) || 0;
        const assignedCount = (event.interpreterIds || []).length;
        if (interpretersNeeded - assignedCount === 0 && assignedCount > 0) {
            return [event.location === 'Hong Kong' ? 'fully-assigned-hong-kong' : 'fully-assigned-macau'];
        }
        return [event.location.toLowerCase()];
    }

    function renderSelectedEvents() {
        elements.eventList.innerHTML = '';
        if (selectedEvents.length === 0) return;

        selectedEvents.forEach(eventId => {
            const event = events.find(e => e.id === eventId);
            if (!event) return;

            const interpretersNeeded = parseInt(event.interpreters) || 0;
            const assignedCount = (event.interpreterIds || []).length;
            const interpretersLeft = interpretersNeeded - assignedCount;

            const row = document.createElement('div');
            row.className = 'event-row';
            row.dataset.id = eventId;
            row.innerHTML = `
                <input type="text" data-field="title" value="${event.title}" class="p-2 border rounded w-64">
                <select data-field="location" class="p-2 border rounded w-32">
                    <option value="Hong Kong" ${event.location === 'Hong Kong' ? 'selected' : ''}>Hong Kong</option>
                    <option value="Macau" ${event.location === 'Macau' ? 'selected' : ''}>Macau</option>
                </select>
                <input type="date" data-field="start" value="${event.start}" class="p-2 border rounded w-32">
                <input type="date" data-field="end" value="${event.end ? new Date(new Date(event.end).setDate(new Date(event.end).getDate() - 1)).toISOString().split('T')[0] : ''}" class="p-2 border rounded w-32">
                <input type="number" data-field="interpreters" value="${event.interpreters}" min="0" class="p-2 border rounded w-32">
                <input type="number" data-field="interpretersLeft" value="${interpretersLeft}" class="p-2 border rounded w-32" readonly>
                <button class="delete-icon" title="Delete Event">🗑️</button>
            `;

            const interpreterRow = document.createElement('div');
            interpreterRow.className = 'interpreter-row';
            interpreterRow.innerHTML = `
                <div class="interpreter-list">
                    <span style="font-size:0.95em;">Assigned Interpreters:</span>
                    <div id="assigned-interpreters-${event.id}" class="assigned-interpreters-list"></div>
                </div>
                <div class="assign-controls">
                    <span style="font-size:0.95em;">Add Interpreter:</span>
                </div>
            `;
            row.appendChild(interpreterRow);

            const inputs = row.querySelectorAll('input:not([data-field="interpreters"],[data-field="interpretersLeft"]), select');
            inputs.forEach(input => {
                input.addEventListener('input', async () => {
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

                    await saveEventsToFirestore(events);
                    renderSelectedEvents();
                    calendar.render();
                });
            });

            const interpretersInput = row.querySelector('input[data-field="interpreters"]');
            interpretersInput.addEventListener('input', async () => {
                event.interpreters = interpretersInput.value || '0';
                const interpretersNeeded = parseInt(event.interpreters) || 0;
                const assignedCount = (event.interpreterIds || []).length;
                row.querySelector('input[data-field="interpretersLeft"]').value = interpretersNeeded - assignedCount;

                const calEvent = calendar.getEventById(eventId);
                if (calEvent) {
                    calEvent.remove();
                    event.classNames = getEventClassNames(event);
                    calendar.addEvent(event);
                }

                await saveEventsToFirestore(events);
                renderSelectedEvents();
                calendar.render();
            });

            const deleteButton = row.querySelector('.delete-icon');
            deleteButton.addEventListener('click', async () => {
                events = events.filter(e => e.id !== eventId);
                const calEvent = calendar.getEventById(eventId);
                if (calEvent) calEvent.remove();
                selectedEvents = selectedEvents.filter(id => id !== eventId);
                assigningInterpreter = null;
                updateTickBoxes();
                await saveEventsToFirestore(events);
                renderSelectedEvents();
                renderInterpreters();
                calendar.render();
            });

            const assignedDiv = row.querySelector(`#assigned-interpreters-${event.id}`);
            assignedDiv.innerHTML = '';
            (event.interpreterIds || []).forEach(intId => {
                const interpreter = interpreters.find(i => i.id === intId);
                if (!interpreter) return;
                const chip = document.createElement('span');
                chip.className = 'assigned-chip';
                chip.textContent = interpreter.name + ' ×';
                chip.title = 'Remove';
                chip.addEventListener('click', async () => {
                    event.interpreterIds = event.interpreterIds.filter(id => id !== intId);
                    const interpretersNeeded = parseInt(event.interpreters) || 0;
                    const assignedCount = (event.interpreterIds || []).length;
                    row.querySelector('input[data-field="interpretersLeft"]').value = interpretersNeeded - assignedCount;

                    const calEvent = calendar.getEventById(eventId);
                    if (calEvent) {
                        calEvent.remove();
                        event.classNames = getEventClassNames(event);
                        calendar.addEvent(event);
                    }

                    await saveEventsToFirestore(events);
                    renderSelectedEvents();
                    renderInterpreters();
                    calendar.render();
                });
                assignedDiv.appendChild(chip);
            });

            if (selectedEvents.includes(eventId)) {
                const assignDiv = row.querySelector('.assign-controls');
                const first12 = interpreters.slice(0, 12).filter(i => !event.interpreterIds.includes(i.id));
                first12.forEach(interpreter => {
                    const btn = document.createElement('button');
                    btn.textContent = interpreter.name;
                    btn.className = 'assign-btn';
                    btn.addEventListener('click', async () => {
                        if (!event.interpreterIds.includes(interpreter.id)) {
                            event.interpreterIds.push(interpreter.id);
                            const interpretersNeeded = parseInt(event.interpreters) || 0;
                            const assignedCount = (event.interpreterIds || []).length;
                            row.querySelector('input[data-field="interpretersLeft"]').value = interpretersNeeded - assignedCount;

                            const calEvent = calendar.getEventById(eventId);
                            if (calEvent) {
                                calEvent.remove();
                                event.classNames = getEventClassNames(event);
                                calendar.addEvent(event);
                            }

                            await saveEventsToFirestore(events);
                            renderSelectedEvents();
                            renderInterpreters();
                            calendar.render();
                        }
                    });
                    assignDiv.appendChild(btn);
                });

                const remaining = interpreters.slice(12).filter(i => !event.interpreterIds.includes(i.id));
                if (remaining.length > 0) {
                    const usageCounts = {};
                    interpreters.forEach(i => {
                        usageCounts[i.id] = events.filter(e => (e.interpreterIds || []).includes(i.id)).length;
                    });
                    remaining.sort((a, b) => usageCounts[b.id] - usageCounts[a.id]);

                    const input = document.createElement('input');
                    input.setAttribute('list', `interpreters-${event.id}`);
                    input.placeholder = 'Type to filter...';
                    input.className = 'p-2 border rounded';
                    const datalist = document.createElement('datalist');
                    datalist.id = `interpreters-${event.id}`;
                    remaining.forEach(i => {
                        const option = document.createElement('option');
                        option.value = i.name;
                        option.dataset.id = i.id;
                        datalist.appendChild(option);
                    });
                    input.addEventListener('input', async () => {
                        const selectedOption = Array.from(datalist.options).find(o => o.value === input.value);
                        if (selectedOption) {
                            const interpreterId = selectedOption.dataset.id;
                            if (!event.interpreterIds.includes(interpreterId)) {
                                event.interpreterIds.push(interpreterId);
                                const interpretersNeeded = parseInt(event.interpreters) || 0;
                                const assignedCount = (event.interpreterIds || []).length;
                                row.querySelector('input[data-field="interpretersLeft"]').value = interpretersNeeded - assignedCount;

                                const calEvent = calendar.getEventById(eventId);
                                if (calEvent) {
                                    calEvent.remove();
                                    event.classNames = getEventClassNames(event);
                                    calendar.addEvent(event);
                                }

                                await saveEventsToFirestore(events);
                                renderSelectedEvents();
                                renderInterpreters();
                                calendar.render();
                                input.value = '';
                            }
                        }
                    });
                    assignDiv.appendChild(input);
                    assignDiv.appendChild(datalist);
                }
            }

            elements.eventList.appendChild(row);
        });
    }

    elements.intEnterBtn.addEventListener('click', async function () {
        const interpreter = {
            id: editingInterpreterId || Date.now().toString(),
            name: elements.intInputs.name.value || 'Unnamed',
            fullName: elements.intInputs.fullName.value || 'Unnamed',
            gender: elements.intInputs.gender.value || 'F',
            idName: elements.intInputs.idName.value || 'None'
        };

        const existingIndex = interpreters.findIndex(i => i.id === interpreter.id);
        if (existingIndex !== -1) {
            interpreters[existingIndex] = interpreter;
        } else {
            interpreters.push(interpreter);
        }

        Object.values(elements.intInputs).forEach(input => input.value = '');
        elements.intInputs.gender.value = 'F'; // Reset to default
        editingInterpreterId = null;
        assigningInterpreter = null;
        updateTickBoxes();

        await saveInterpretersToFirestore(interpreters);
        renderInterpreters();
        calendar.render();
    });

    function renderInterpreters() {
        elements.interpreterList.innerHTML = '';
        interpreters.forEach((interpreter, index) => {
            const row = document.createElement('tr');
            row.dataset.id = interpreter.id;
            row.draggable = true; // Make the row draggable
            row.className = assigningInterpreter && assigningInterpreter.id === interpreter.id ? 'interpreter-assigned' : '';
            row.innerHTML = `
                <td>
                    <div class="flex items-center">
                        <div class="w-full text-center">${interpreter.name}</div>
                        <span class="drag-handle" title="Drag to reorder">☰</span>
                    </div>
                </td>
                <td><button class="assign-mode-btn" title="Assign Working Days">🗓️</button></td>
                <td><button class="edit-int" title="Edit">✏️</button></td>
                <td><button class="delete-int" title="Delete">🗑️</button></td>
            `;

            // Drag-and-drop event listeners
            row.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', interpreter.id);
                row.classList.add('dragging');
            });

            row.addEventListener('dragend', () => {
                row.classList.remove('dragging');
            });

            row.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            row.addEventListener('drop', async (e) => {
                e.preventDefault();
                const draggedId = e.dataTransfer.getData('text/plain');
                const draggedInterpreter = interpreters.find(i => i.id === draggedId);
                const targetIndex = interpreters.findIndex(i => i.id === interpreter.id);

                if (draggedId !== interpreter.id) {
                    interpreters = interpreters.filter(i => i.id !== draggedId);
                    interpreters.splice(targetIndex, 0, draggedInterpreter);
                    await saveInterpretersToFirestore(interpreters);
                    renderInterpreters();
                }
            });

            const assignBtn = row.querySelector('.assign-mode-btn');
            assignBtn.addEventListener('click', async () => {
                if (assigningInterpreter && assigningInterpreter.id === interpreter.id) {
                    await saveAssignmentsToFirestore(interpreter.id, interpreterAssignments[interpreter.id] || {});
                    assigningInterpreter = null;
                } else {
                    if (assigningInterpreter) {
                        await saveAssignmentsToFirestore(assigningInterpreter.id, interpreterAssignments[assigningInterpreter.id] || {});
                    }
                    assigningInterpreter = { id: interpreter.id, name: interpreter.name };
                }
                renderInterpreters();
                updateTickBoxes();
                calendar.render();

                document.querySelectorAll('.fc-daygrid-day').forEach(cell => {
                    const cellDateStr = cell.getAttribute('data-date');
                    if (!cellDateStr || !assigningInterpreter) {
                        cell.classList.remove('interpreter-assigned', 'interpreter-overlap', 'interpreter-working');
                        return;
                    }
                    const assignments = interpreterAssignments[assigningInterpreter.id] || {};
                    if (assignments[cellDateStr]) {
                        cell.classList.remove('interpreter-assigned', 'interpreter-overlap');
                        cell.classList.add('interpreter-working');
                    } else {
                        let eventCount = 0;
                        events.forEach(event => {
                            if ((event.interpreterIds || []).includes(assigningInterpreter.id)) {
                                const start = new Date(event.start.split('T')[0]);
                                const end = new Date((event.end || event.start).split('T')[0]);
                                const current = new Date(cellDateStr);
                                if (current >= start && current < end) eventCount++;
                            }
                        });
                        cell.classList.remove('interpreter-assigned', 'interpreter-overlap', 'interpreter-working');
                        if (eventCount >= 2) cell.classList.add('interpreter-overlap');
                        else if (eventCount === 1) cell.classList.add('interpreter-assigned');
                    }
                });
            });

            const editBtn = row.querySelector('.edit-int');
            editBtn.addEventListener('click', () => {
                elements.intInputs.name.value = interpreter.name;
                elements.intInputs.fullName.value = interpreter.fullName;
                elements.intInputs.gender.value = interpreter.gender || 'F';
                elements.intInputs.idName.value = interpreter.idName;
                editingInterpreterId = interpreter.id;
            });

            const deleteBtn = row.querySelector('.delete-int');
            deleteBtn.addEventListener('click', async () => {
                interpreters = interpreters.filter(i => i.id !== interpreter.id);
                events.forEach(ev => {
                    if (ev.interpreterIds && ev.interpreterIds.includes(interpreter.id)) {
                        ev.interpreterIds = ev.interpreterIds.filter(id => id !== interpreter.id);
                    }
                });
                if (interpreterAssignments[interpreter.id]) {
                    delete interpreterAssignments[interpreter.id];
                    await saveAssignmentsToFirestore(interpreter.id, {});
                }
                await saveInterpretersToFirestore(interpreters);
                await saveEventsToFirestore(events);
                renderInterpreters();
                renderSelectedEvents();
                calendar.render();
            });

            elements.interpreterList.appendChild(row);
        });
    }

    elements.exitAllBtn.addEventListener('click', () => {
        if (selectedEvents.length > 0) {
            // Create a copy of selectedEvents to iterate over
            const eventsToUnselect = [...selectedEvents];
            // Clear selectedEvents immediately
            selectedEvents = [];
            // Update each event's classNames and re-render in the calendar
            eventsToUnselect.forEach(eventId => {
                const event = events.find(e => e.id === eventId);
                if (event) {
                    // Reset classNames to original state
                    event.classNames = getEventClassNames(event);
                    const calEvent = calendar.getEventById(eventId);
                    if (calEvent) {
                        calEvent.remove();
                        calendar.addEvent(event);
                    }
                }
            });
            assigningInterpreter = null;
            updateTickBoxes();
            renderSelectedEvents();
            renderInterpreters();
            calendar.render();
        }
    });

    async function loadAllDataAndRender() {
        events = await loadEventsFromFirestore();
        interpreters = await loadInterpretersFromFirestore();
        interpreterAssignments = await loadAssignmentsFromFirestore();
        events.forEach(ev => {
            ev.classNames = getEventClassNames(ev);
            calendar.addEvent(ev);
        });
        renderSelectedEvents();
        renderInterpreters();
        updateMonthSelector();
        calendar.render();
    }

    loadAllDataAndRender();

    function updateAssigningLabel() {
        const label = document.getElementById('assigning-box');
        if (!label) {
            return;
        }
        if (assigningInterpreter) {
            label.textContent = `Assigning for ${assigningInterpreter.name}`;
            label.classList.remove('hidden');
        } else {
            label.classList.add('hidden');
        }
    }

    const originalRender = calendar.render.bind(calendar);
    calendar.render = function () {
        originalRender();
        updateAssigningLabel();
    };
});