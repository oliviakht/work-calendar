document.addEventListener('DOMContentLoaded', function () {
    // --- Storage Setup (localStorage) ---
    function saveEvents(events) {
        try {
            localStorage.setItem('calendarEvents', JSON.stringify(events));
            console.log('Events saved to localStorage:', events);
        } catch (error) {
            console.error('Save events to localStorage error:', error);
            alert('Failed to save events to localStorage. Data may not persist. Error: ' + error.message);
        }
    }

    function loadEvents() {
        try {
            const data = localStorage.getItem('calendarEvents');
            const events = data ? JSON.parse(data) : [];
            console.log('Events loaded from localStorage:', events);
            return events;
        } catch (error) {
            console.error('Load events from localStorage error:', error);
            return [];
        }
    }

    function saveInterpreters(interpreters) {
        try {
            localStorage.setItem('calendarInterpreters', JSON.stringify(interpreters));
            console.log('Interpreters saved to localStorage:', interpreters);
        } catch (error) {
            console.error('Save interpreters to localStorage error:', error);
            alert('Failed to save interpreters to localStorage. Data may not persist. Error: ' + error.message);
        }
    }

    function loadInterpreters() {
        try {
            const data = localStorage.getItem('calendarInterpreters');
            const interpreters = data ? JSON.parse(data) : [];
            console.log('Interpreters loaded from localStorage:', interpreters);
            return interpreters;
        } catch (error) {
            console.error('Load interpreters from localStorage error:', error);
            return [];
        }
    }

    function saveAssignments(interpreterId, assignments) {
        try {
            let allAssignments = JSON.parse(localStorage.getItem('calendarAssignments') || '{}');
            allAssignments[interpreterId] = assignments;
            localStorage.setItem('calendarAssignments', JSON.stringify(allAssignments));
            console.log('Assignments saved to localStorage for:', interpreterId, assignments);
        } catch (error) {
            console.error('Save assignments to localStorage error:', error);
            alert('Failed to save assignments to localStorage. Data may not persist. Error: ' + error.message);
        }
    }

    function loadAssignments() {
        try {
            const data = localStorage.getItem('calendarAssignments');
            const assignments = data ? JSON.parse(data) : {};
            console.log('Assignments loaded from localStorage:', assignments);
            return assignments;
        } catch (error) {
            console.error('Load assignments from localStorage error:', error);
            return {};
        }
    }

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

    // --- Firestore Storage Functions (Fallback to localStorage) ---
    async function saveEventsToFirestore(events) {
        try {
            await db.collection('calendar').doc('events').set({ events });
            console.log('Events saved to Firestore:', events);
        } catch (error) {
            console.error('Save events to Firestore error:', error);
            saveEvents(events); // Fallback to localStorage
            alert('Failed to save events to Firestore. Saved to localStorage instead. Error: ' + error.message);
        }
    }

    async function loadEventsFromFirestore() {
        try {
            const doc = await db.collection('calendar').doc('events').get();
            const events = doc.exists ? doc.data().events : [];
            console.log('Events loaded from Firestore:', events);
            return events;
        } catch (error) {
            console.error('Load events from Firestore error:', error);
            return loadEvents();
        }
    }

    async function saveInterpretersToFirestore(interpreters) {
        try {
            await db.collection('calendar').doc('interpreters').set({ interpreters });
            console.log('Interpreters saved to Firestore:', interpreters);
        } catch (error) {
            console.error('Save interpreters to Firestore error:', error);
            saveInterpreters(interpreters); // Fallback to localStorage
            alert('Failed to save interpreters to Firestore. Saved to localStorage instead. Error: ' + error.message);
        }
    }

    async function loadInterpretersFromFirestore() {
        try {
            const doc = await db.collection('calendar').doc('interpreters').get();
            const interpreters = doc.exists ? doc.data().interpreters : [];
            console.log('Interpreters loaded from Firestore:', interpreters);
            return interpreters;
        } catch (error) {
            console.error('Load interpreters from Firestore error:', error);
            return loadInterpreters();
        }
    }

    async function saveAssignmentsToFirestore(interpreterId, assignments) {
        try {
            let allAssignments = await loadAssignmentsFromFirestore();
            allAssignments[interpreterId] = assignments;
            await db.collection('calendar').doc('assignments').set(allAssignments);
            console.log('Assignments saved to Firestore for:', interpreterId, assignments);
        } catch (error) {
            console.error('Save assignments to Firestore error:', error);
            saveAssignments(interpreterId, assignments); // Fallback to localStorage
            alert('Failed to save assignments to Firestore. Saved to localStorage instead. Error: ' + error.message);
        }
    }

    async function loadAssignmentsFromFirestore() {
        try {
            const doc = await db.collection('calendar').doc('assignments').get();
            const assignments = doc.exists ? doc.data() : {};
            console.log('Assignments loaded from Firestore:', assignments);
            return assignments;
        } catch (error) {
            console.error('Load assignments from Firestore error:', error);
            return loadAssignments();
        }
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

    // Validate DOM elements
    Object.entries(elements).forEach(([key, el]) => {
        if (!el && typeof el !== 'object') console.error(`Element ${key} not found`);
    });

    // Create assigning label
    const calendarContainer = elements.calendar.parentElement;
    const assigningLabel = document.createElement('div');
    assigningLabel.id = 'assigning-label';
    assigningLabel.style.display = 'none';
    assigningLabel.className = 'text-center text-lg font-semibold mb-2';
    calendarContainer.insertBefore(assigningLabel, elements.calendar);

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
            console.log('Event clicked:', info.event.id, 'Selected:', selectedEvents);
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
                assigningInterpreter = null;
                updateTickBoxes();
            } else {
                selectedEvents.push(eventId);
                info.event.setProp('classNames', ['selected']);
                assigningInterpreter = null;
                updateTickBoxes();
            }

            renderSelectedEvents();
            renderInterpreters();
            calendar.render();
        },
        dayCellClassNames: function (info) {
            const classes = [];
            if (!assigningInterpreter) {
                console.log('No assigning interpreter for date:', info.date.toISOString());
                return classes;
            }

            const dateStr = info.el.getAttribute('data-date');
            console.log(`Processing date: ${dateStr}, Interpreter: ${assigningInterpreter.id}, Events:`, events);

            const assignments = interpreterAssignments[assigningInterpreter.id] || {};
            if (assignments[dateStr]) {
                classes.push('interpreter-working');
                console.log(`Assigning interpreter-working to ${dateStr}`);
                return classes;
            }

            let eventCount = 0;
            events.forEach(event => {
                const startStr = event.start.split('T')[0];
                const endStr = event.end ? event.end.split('T')[0] : startStr;
                console.log(`Event ${event.id}: Start=${startStr}, End=${endStr}, InterpreterIds=`, event.interpreterIds);

                if ((event.interpreterIds || []).includes(assigningInterpreter.id)) {
                    const startDate = new Date(startStr);
                    const endDate = new Date(endStr);
                    const currentDate = new Date(dateStr);
                    startDate.setHours(0, 0, 0, 0);
                    endDate.setHours(0, 0, 0, 0);
                    currentDate.setHours(0, 0, 0, 0);

                    if (currentDate >= startDate && currentDate < endDate) {
                        eventCount++;
                        console.log(`Match: Event ${event.id} on ${dateStr}, Count: ${eventCount}`);
                    }
                }
            });

            if (eventCount >= 2) {
                classes.push('interpreter-overlap');
                console.log(`Assigning interpreter-overlap to ${dateStr} (Count: ${eventCount})`);
            } else if (eventCount === 1) {
                classes.push('interpreter-assigned');
                console.log(`Assigning interpreter-assigned to ${dateStr}`);
            }

            console.log(`Classes for ${dateStr}:`, classes);
            return classes;
        },
        dayCellDidMount: function (info) {
            const dateStr = info.el.getAttribute('data-date');
            const topElement = info.el.querySelector('.fc-daygrid-day-top');

            if (topElement) {
                let tickbox = topElement.querySelector(`#tickbox-${dateStr}`);
                if (!tickbox) {
                    console.log('Creating tickbox for:', dateStr);
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
                    console.log(`Tickbox ${dateStr} initialized: checked=${tickbox.checked}`);
                }
            } else {
                console.warn(`Top element not found for date: ${dateStr}`);
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
                console.warn(`Tickbox ${dateStr} changed but no assigning interpreter`);
                return;
            }

            const interpreterId = assigningInterpreter.id;
            if (!interpreterAssignments[interpreterId]) {
                interpreterAssignments[interpreterId] = {};
            }
            interpreterAssignments[interpreterId][dateStr] = tickbox.checked;
            saveAssignmentsToFirestore(interpreterId, interpreterAssignments[interpreterId]).then(() => {
                console.log(`Tickbox ${dateStr} changed: checked=${tickbox.checked}, Assignments:`, interpreterAssignments[interpreterId]);

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
                            console.log(`Manually applied interpreter-working to ${dateStr}`);
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
        console.log('Updating tickboxes, Assigning Interpreter:', assigningInterpreter ? assigningInterpreter.id : 'none');
        document.querySelectorAll('.date-tickbox').forEach(tickbox => {
            const dateStr = tickbox.id.replace('tickbox-', '');
            tickbox.disabled = !assigningInterpreter;
            if (assigningInterpreter) {
                const assignments = interpreterAssignments[assigningInterpreter.id] || {};
                tickbox.checked = !!assignments[dateStr];
            } else {
                tickbox.checked = false;
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
            console.log('Rendering SEA for event:', eventId, 'Found:', !!event);
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
                console.log('Rendering assign controls for event:', eventId, 'Interpreter IDs:', event.interpreterIds);
                const assignDiv = row.querySelector('.assign-controls');
                const first12 = interpreters.slice(0, 12).filter(i => !event.interpreterIds.includes(i.id));
                first12.forEach(interpreter => {
                    const btn = document.createElement('button');
                    btn.textContent = interpreter.name;
                    btn.className = 'assign-btn';
                    btn.addEventListener('click', async () => {
                        if (!event.interpreterIds.includes(interpreter.id)) {
                            event.interpreterIds.push(interpreter.id);
                            console.log('Assigned interpreter:', interpreter.id, 'to event:', eventId, 'New interpreterIds:', event.interpreterIds);
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
                console.log('Remaining interpreters for datalist:', remaining.length, remaining.map(i => i.name));
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
                                console.log('Assigned interpreter via datalist:', interpreterId, 'to event:', eventId, 'New interpreterIds:', event.interpreterIds);
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
            idName: elements.intInputs.idName.value || 'None'
        };
        console.log('Adding/Editing interpreter:', interpreter, 'Editing ID:', editingInterpreterId);

        const existingIndex = interpreters.findIndex(i => i.id === interpreter.id);
        if (existingIndex !== -1) {
            interpreters[existingIndex] = interpreter;
        } else {
            interpreters.push(interpreter);
        }

        Object.values(elements.intInputs).forEach(input => input.value = '');
        editingInterpreterId = null;
        assigningInterpreter = null;
        updateTickBoxes();

        await saveInterpretersToFirestore(interpreters);
        renderInterpreters();
        calendar.render();
    });

    function renderInterpreters() {
        console.log('Rendering interpreters:', interpreters);
        elements.interpreterList.innerHTML = '';
        interpreters.forEach(interpreter => {
            const row = document.createElement('tr');
            row.dataset.id = interpreter.id;
            row.className = assigningInterpreter && assigningInterpreter.id === interpreter.id ? 'interpreter-assigned' : '';
            row.innerHTML = `
                <td>${interpreter.name}</td>
                <td><button class="assign-mode-btn" title="Assign Working Days">🗓️</button></td>
                <td><button class="edit-int" title="Edit">✏️</button></td>
                <td><button class="delete-int" title="Delete">🗑️</button></td>
            `;

            const assignBtn = row.querySelector('.assign-mode-btn');
            assignBtn.addEventListener('click', async () => {
                console.log('Assign button clicked for:', interpreter.id, 'Current mode:', assigningInterpreter ? assigningInterpreter.id : 'none', 'Events:', events);
                if (assigningInterpreter && assigningInterpreter.id === interpreter.id) {
                    await saveAssignmentsToFirestore(interpreter.id, interpreterAssignments[interpreter.id] || {});
                    assigningInterpreter = null;
                    console.log('Exiting assigning mode');
                } else {
                    if (assigningInterpreter) {
                        await saveAssignmentsToFirestore(assigningInterpreter.id, interpreterAssignments[assigningInterpreter.id] || {});
                    }
                    assigningInterpreter = { id: interpreter.id, name: interpreter.name };
                    console.log('Entering assigning mode for:', assigningInterpreter);
                }
                renderInterpreters();
                updateTickBoxes();
                calendar.render();

                document.querySelectorAll('.fc-daygrid-day').forEach(cell => {
                    const dateStr = cell.getAttribute('data-date');
                    if (!dateStr || !assigningInterpreter) {
                        cell.classList.remove('interpreter-assigned', 'interpreter-overlap', 'interpreter-working');
                        return;
                    }
                    const assignments = interpreterAssignments[assigningInterpreter.id] || {};
                    if (assignments[dateStr]) {
                        cell.classList.remove('interpreter-assigned', 'interpreter-overlap');
                        cell.classList.add('interpreter-working');
                        console.log(`Manually applied interpreter-working to ${dateStr}`);
                    } else {
                        let eventCount = 0;
                        events.forEach(event => {
                            if ((event.interpreterIds || []).includes(assigningInterpreter.id)) {
                                const start = new Date(event.start.split('T')[0]);
                                const end = new Date((event.end || event.start).split('T')[0]);
                                const current = new Date(dateStr);
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
                console.log('Edit button clicked for interpreter:', interpreter.id);
                elements.intInputs.name.value = interpreter.name;
                elements.intInputs.fullName.value = interpreter.fullName;
                elements.intInputs.idName.value = interpreter.idName;
                editingInterpreterId = interpreter.id;
                console.log('Set editingInterpreterId:', editingInterpreterId);
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
        const label = document.getElementById('assigning-label');
        if (!label) {
            console.warn('Assigning label not found');
            return;
        }
        if (assigningInterpreter) {
            label.textContent = `Assigning for ${assigningInterpreter.name}`;
            label.style.display = 'block';
        } else {
            label.style.display = 'none';
        }
    }

    const originalRender = calendar.render.bind(calendar);
    calendar.render = function () {
        console.log('Rendering calendar, assigningInterpreter:', assigningInterpreter ? assigningInterpreter.id : 'none');
        originalRender();
        updateAssigningLabel();
        console.log('Calendar rendered');
    };
});