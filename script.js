document.addEventListener('DOMContentLoaded', function () {
    // --- IndexedDB setup ---
    const DB_NAME = 'calendarDB';
    const DB_VERSION = 1;
    let db = null;

    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = function (e) {
                db = e.target.result;
                if (!db.objectStoreNames.contains('events')) {
                    db.createObjectStore('events', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('interpreters')) {
                    db.createObjectStore('interpreters', { keyPath: 'id' });
                }
            };
            request.onsuccess = function (e) {
                db = e.target.result;
                resolve();
            };
            request.onerror = function (e) {
                reject(e);
            };
        });
    }

    function saveEvents(events) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction('events', 'readwrite');
            const store = tx.objectStore('events');
            store.clear();
            for (const event of events) {
                store.put(event);
            }
            tx.oncomplete = () => resolve();
            tx.onerror = e => reject(e);
        });
    }

    function loadEvents() {
        return new Promise((resolve, reject) => {
            const tx = db.transaction('events', 'readonly');
            const store = tx.objectStore('events');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = e => reject(e);
        });
    }

    function saveInterpreters(interpreters) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction('interpreters', 'readwrite');
            const store = tx.objectStore('interpreters');
            store.clear();
            for (const interpreter of interpreters) {
                store.put(interpreter);
            }
            tx.oncomplete = () => resolve();
            tx.onerror = e => reject(e);
        });
    }

    function loadInterpreters() {
        return new Promise((resolve, reject) => {
            const tx = db.transaction('interpreters', 'readonly');
            const store = tx.objectStore('interpreters');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = e => reject(e);
        });
    }

    // --- DOM Elements ---
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

    // --- State ---
    let events = [];
    let selectedEvents = [];
    let interpreters = [];
    let editingInterpreterId = null;
    let selectingAssignedFor = null;
    let assigningInterpreter = null;
    let interpreterAssignments = {};

    // --- FullCalendar ---
    const calendar = new FullCalendar.Calendar(elements.calendar, {
        initialView: 'dayGridMonth',
        events: [],
        eventClick: function (info) {
            const eventId = info.event.id;
            const isSelected = selectedEvents.includes(eventId);

            if (isSelected) {
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
                    if ((event.interpreterIds || []).includes(assigningInterpreter.id)) {
                        const start = new Date(event.start);
                        start.setHours(0, 0, 0, 0);
                        const end = new Date(event.end || event.start);
                        end.setHours(0, 0, 0, 0);
                        if (date >= start && date < end) {
                            assignmentCount++;
                        }
                    }
                });

                if (assignmentCount >= 2) {
                    classes.push('interpreter-overlap');
                } else if (assignmentCount === 1) {
                    classes.push('interpreter-assigned');
                }

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
                tickbox.checked = false;
                topElement.appendChild(tickbox);

                tickbox.addEventListener('change', () => {
                    if (assigningInterpreter) {
                        const interpreterId = assigningInterpreter.id;
                        if (!interpreterAssignments[interpreterId]) {
                            interpreterAssignments[interpreterId] = {};
                        }
                        interpreterAssignments[interpreterId][dateStr] = tickbox.checked;
                        calendar.render();
                    }
                });

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

    elements.monthSelector.addEventListener('change', function () {
        const month = parseInt(this.value);
        calendar.gotoDate(new Date(calendar.getDate().getFullYear(), month, 1));
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
            assigned: '',
            interpreterIds: [] // Store assigned interpreter ids for this event
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

        await saveEvents(events);

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
                <input type="text" data-field="title" value="${event.title}" class="p-2 border rounded w-32">
                <select data-field="location" class="p-2 border rounded w-32">
                  <option value="Hong Kong" ${event.location === 'Hong Kong' ? 'selected' : ''}>Hong Kong</option>
                  <option value="Macau" ${event.location === 'Macau' ? 'selected' : ''}>Macau</option>
                </select>
                <input type="date" data-field="start" value="${event.start}" class="p-2 border rounded w-32">
                <input type="date" data-field="end" value="${event.end ? new Date(new Date(event.end).setDate(new Date(event.end).getDate() - 1)).toISOString().split('T')[0] : ''}" class="p-2 border rounded w-32">
                <input type="number" data-field="interpreters" value="${event.interpreters}" min="0" class="p-2 border rounded w-32">
                <input type="number" data-field="interpretersLeft" value="${interpretersLeft}" class="p-2 border rounded w-32" readonly>
                <button class="delete-icon" title="Delete Event">🗑️</button>
                <div class="interpreter-list" style="margin-top: 8px;">
                    <span style="font-size:0.95em;">Assigned Interpreters:</span>
                    <div id="assigned-interpreters-${event.id}" class="assigned-interpreters-list"></div>
                </div>
            `;

            // Event field inputs
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

                    await saveEvents(events);
                    renderSelectedEvents();
                    calendar.render();
                });
            });

            // Interpreters needed
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

                await saveEvents(events);
                renderSelectedEvents();
                calendar.render();
            });

            // Delete event
            const deleteButton = row.querySelector('.delete-icon');
            deleteButton.addEventListener('click', async () => {
                events = events.filter(e => e.id !== eventId);
                const calEvent = calendar.getEventById(eventId);
                if (calEvent) calEvent.remove();
                selectedEvents = selectedEvents.filter(id => id !== eventId);
                if (selectingAssignedFor && selectingAssignedFor.eventId === eventId) selectingAssignedFor = null;
                assigningInterpreter = null;
                resetTickBoxes();
                await saveEvents(events);
                renderSelectedEvents();
                renderInterpreters();
                calendar.render();
            });

            // Render assigned interpreters as removable chips
            const assignedDiv = row.querySelector(`#assigned-interpreters-${event.id}`);
            assignedDiv.innerHTML = '';
            (event.interpreterIds || []).forEach(intId => {
                const interpreter = interpreters.find(i => i.id === intId);
                if (!interpreter) return;
                const chip = document.createElement('span');
                chip.className = 'assigned-chip';
                chip.style = 'background:#dff0d8; margin-right:4px; padding:2px 7px; border-radius:12px; display:inline-block;';
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

                    await saveEvents(events);
                    renderSelectedEvents();
                    renderInterpreters();
                    calendar.render();
                });
                assignedDiv.appendChild(chip);
            });

            // Show list of assignable interpreters only for selected events
            if (selectedEvents.includes(eventId)) {
                const assignDiv = document.createElement('div');
                assignDiv.style = 'margin-top:5px;';
                assignDiv.innerHTML = '<span style="font-size:0.9em">Add Interpreter:</span> ';
                interpreters.forEach(interpreter => {
                    const isAssigned = (event.interpreterIds || []).includes(interpreter.id);
                    if (!isAssigned) {
                        const btn = document.createElement('button');
                        btn.textContent = interpreter.name;
                        btn.className = 'assign-btn';
                        btn.style = 'margin:2px 5px 2px 0; padding:1px 8px; font-size:0.9em;';
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

                                await saveEvents(events);
                                renderSelectedEvents();
                                renderInterpreters();
                                calendar.render();
                            }
                        });
                        assignDiv.appendChild(btn);
                    }
                });
                row.appendChild(assignDiv);
            }
            elements.eventList.appendChild(row);
        });
    }

    elements.intEnterBtn.addEventListener('click', async function () {
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

        await saveInterpreters(interpreters);

        renderInterpreters();
        calendar.render();
    });

    function renderInterpreters() {
        elements.interpreterList.innerHTML = '';
        interpreters.forEach(interpreter => {
            const row = document.createElement('tr');
            row.dataset.id = interpreter.id;

            // Show interpreters only if an event is selected, and allow assigning only for selected events
            row.innerHTML = `
                <td>${interpreter.name}</td>
                <td>${interpreter.fullName}</td>
                <td>${interpreter.idName}</td>
                <td><button class="edit-int" title="Edit">✏️</button></td>
                <td><button class="delete-int" title="Delete">🗑️</button></td>
            `;

            // Edit interpreter
            row.querySelector('.edit-int').addEventListener('click', () => {
                elements.intInputs.name.value = interpreter.name;
                elements.intInputs.fullName.value = interpreter.fullName;
                elements.intInputs.idName.value = interpreter.idName;
                editingInterpreterId = interpreter.id;
            });

            // Delete interpreter (removes from all events too)
            row.querySelector('.delete-int').addEventListener('click', async () => {
                interpreters = interpreters.filter(i => i.id !== interpreter.id);
                events.forEach(ev => {
                    if (ev.interpreterIds && ev.interpreterIds.includes(interpreter.id)) {
                        ev.interpreterIds = ev.interpreterIds.filter(id => id !== interpreter.id);
                    }
                });
                await saveInterpreters(interpreters);
                await saveEvents(events);
                renderInterpreters();
                renderSelectedEvents();
                calendar.render();
            });

            elements.interpreterList.appendChild(row);
        });
    }

    // --- INITIALIZATION ---

    async function loadAllDataAndRender() {
        await openDatabase();
        events = await loadEvents();
        interpreters = await loadInterpreters();
        // Render all events into FullCalendar
        events.forEach(ev => {
            ev.classNames = getEventClassNames(ev);
            calendar.addEvent(ev);
        });
        renderSelectedEvents();
        renderInterpreters();
        calendar.render();
    }

    loadAllDataAndRender();
});