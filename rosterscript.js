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

    // --- DOM Elements ---
    const eventDropdown = document.getElementById('eventDropdown');
    const groupBtn = document.getElementById('groupBtn');
    const rosterList = document.getElementById('rosterList');
    const tableHeadRow = document.querySelector('thead tr');

    // --- State ---
    let events = [];
    let interpreters = {};
    let interpreterAssignments = {};
    let positions = ['Show Director', 'Stage Director', 'Lighting'];
    let selectedInterpreterIds = new Set();
    let isGroupingMode = false;
    let hasGroupColumn = false;
    let isFinishGroupingMode = false;
    let groups = []; // Array to store group data: { startRow, endRow, name }

    // --- Load Data ---
    async function loadData() {
        const eventDoc = await db.collection('calendar').doc('events').get();
        events = eventDoc.exists ? eventDoc.data().events : [];
        const interpreterDoc = await db.collection('calendar').doc('interpreters').get();
        interpreters = interpreterDoc.exists ? Object.fromEntries(interpreterDoc.data().interpreters.map(i => [i.id, i])) : {};
        const assignmentDoc = await db.collection('calendar').doc('assignments').get();
        interpreterAssignments = assignmentDoc.exists ? assignmentDoc.data() : {};
        populateEventDropdown();
    }

    // --- Populate Event Dropdown ---
    function populateEventDropdown() {
        const today = new Date('2025-05-18T02:48:00-06:00'); // Current date and time in CST
        eventDropdown.innerHTML = '<option value="">Select an Event</option>';
        events.forEach(event => {
            const endDate = new Date(event.end);
            if (endDate >= today) {
                const option = document.createElement('option');
                option.value = event.id;
                option.textContent = `${event.title} (${event.start} to ${event.end})`;
                eventDropdown.appendChild(option);
            }
        });
        updateRosterTable();
    }

    // --- Add Group Column ---
    function addGroupColumn() {
        if (!hasGroupColumn) {
            const groupHeader = document.createElement('th');
            groupHeader.className = 'p-2 border';
            tableHeadRow.insertBefore(groupHeader, tableHeadRow.firstChild);

            const rows = rosterList.querySelectorAll('tr');
            rows.forEach(row => {
                const td = document.createElement('td');
                td.className = 'p-2 border';
                row.insertBefore(td, row.firstChild);
            });

            hasGroupColumn = true;
        }
    }

    // --- Update Roster Table ---
    function updateRosterTable() {
        const eventId = eventDropdown.value;
        rosterList.innerHTML = '';
        if (!eventId) return;

        const selectedEvent = events.find(e => e.id === eventId);
        if (!selectedEvent) return;

        const startDate = new Date(selectedEvent.start);
        const endDate = new Date(selectedEvent.end);
        const dateColumns = [];
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            dateColumns.push(d.toISOString().split('T')[0]);
        }

        // Update thead with date columns
        while (tableHeadRow.children.length > (hasGroupColumn ? 6 : 5)) {
            tableHeadRow.removeChild(tableHeadRow.lastChild);
        }
        dateColumns.forEach(date => {
            const th = document.createElement('th');
            th.className = 'p-2 border';
            th.textContent = new Date(date).getDate() + ' ' + new Date(date).toLocaleString('default', { month: 'short' });
            tableHeadRow.appendChild(th);
        });

        // Populate tbody with interpreters
        const assignedInterpreterIds = selectedEvent.interpreterIds || [];
        let rowNum = 1;
        const rows = assignedInterpreterIds.map(intId => {
            const interpreter = interpreters[intId];
            if (!interpreter) return null;

            const row = document.createElement('tr');
            row.dataset.id = intId;
            row.draggable = true;
            row.classList.toggle('selected', selectedInterpreterIds.has(intId));
            row.innerHTML = `
                ${hasGroupColumn ? '<td class="p-2 border"></td>' : ''}
                <td class="p-2 border">${rowNum++}</td>
                <td class="p-2 border">${interpreter.fullName}</td>
                <td class="p-2 border">${interpreter.idName}</td>
                <td class="p-2 border">${interpreter.gender || 'F'}</td>
                <td class="p-2 border relative">
                    <span id="positionDisplay-${intId}" class="position-display cursor-pointer">${positions.includes('Support') ? 'Support' : positions[0]}</span>
                    <div id="positionDropdown-${intId}" class="position-dropdown hidden absolute bg-white z-10"></div>
                </td>
            `;

            dateColumns.forEach(date => {
                const td = document.createElement('td');
                td.className = 'p-2 border text-center';
                const assignments = interpreterAssignments[intId] || {};
                if (assignments[date]) {
                    td.textContent = 'o';
                }
                row.appendChild(td);
            });

            row.addEventListener('click', (e) => {
                if (!isGroupingMode) return;
                if (!e.target.closest('td').querySelector('input, select, button')) {
                    selectedInterpreterIds.has(intId) ? selectedInterpreterIds.delete(intId) : selectedInterpreterIds.add(intId);
                    row.classList.toggle('selected');
                }
            });

            row.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', intId);
                row.classList.add('dragging');
            });

            row.addEventListener('dragend', () => {
                row.classList.remove('dragging');
            });

            row.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            row.addEventListener('drop', (e) => {
                e.preventDefault();
                const draggedId = e.dataTransfer.getData('text/plain');
                const draggedRow = document.querySelector(`tr[data-id="${draggedId}"]`);
                const targetRow = row;

                if (draggedId !== intId && draggedRow && targetRow) {
                    const draggedIndex = Array.from(rosterList.children).indexOf(draggedRow);
                    const targetIndex = Array.from(rosterList.children).indexOf(targetRow);
                    rosterList.removeChild(draggedRow);
                    rosterList.insertBefore(draggedRow, targetRow);
                    updateRowNumbers();
                    applyGroups();
                }
            });

            const positionDisplay = row.querySelector(`#positionDisplay-${intId}`);
            const positionDropdown = row.querySelector(`#positionDropdown-${intId}`);
            positionDisplay.addEventListener('click', () => {
                positionDropdown.classList.toggle('hidden');
                positionDropdown.innerHTML = positions.map(p => `<div class="p-1 hover:bg-gray-200 cursor-pointer" data-position="${p}">${p}</div>`).join('');
                positionDropdown.innerHTML += `
                    <div class="flex p-1 border-t">
                        <button id="addPosition-${intId}" class="bg-green-500 text-white px-1 rounded hover:bg-green-600 mr-1">+</button>
                        <button id="deletePosition-${intId}" class="bg-red-500 text-white px-1 rounded hover:bg-red-600">-</button>
                    </div>
                `;

                const addPositionBtn = positionDropdown.querySelector(`#addPosition-${intId}`);
                addPositionBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const newPosition = prompt('Enter new position:');
                    if (newPosition && !positions.includes(newPosition)) {
                        positions.push(newPosition);
                        updatePositionDropdown(intId);
                        positionDropdown.classList.remove('hidden');
                    }
                });

                const deletePositionBtn = positionDropdown.querySelector(`#deletePosition-${intId}`);
                deletePositionBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const currentPosition = positionDisplay.textContent;
                    if (currentPosition && positions.length > 1) {
                        positions = positions.filter(p => p !== currentPosition);
                        positionDisplay.textContent = positions[0];
                        updatePositionDropdown(intId);
                        positionDropdown.classList.remove('hidden');
                    }
                });
            });

            document.addEventListener('click', (e) => {
                if (!positionDisplay.contains(e.target) && !positionDropdown.contains(e.target)) {
                    positionDropdown.classList.add('hidden');
                }
            });

            positionDropdown.addEventListener('click', (e) => {
                if (e.target.hasAttribute('data-position')) {
                    const newPosition = e.target.getAttribute('data-position');
                    positionDisplay.textContent = newPosition;
                    positionDropdown.classList.add('hidden');
                    console.log(`Updated ${intId} position to ${newPosition}`);
                }
            });

            return row;
        }).filter(row => row).forEach(row => rosterList.appendChild(row));

        applyGroups();
    }

    // --- Update Row Numbers ---
    function updateRowNumbers() {
        let rowNum = 1;
        const rows = rosterList.querySelectorAll('tr:not(.header-row)');
        rows.forEach(row => {
            const numCell = row.querySelector('td:nth-child(' + (hasGroupColumn ? 2 : 1) + ')');
            if (numCell) {
                numCell.textContent = rowNum++;
            }
        });
    }

    // --- Apply Existing Groups ---
    function applyGroups() {
        const rows = Array.from(rosterList.querySelectorAll('tr:not(.header-row)'));
        groups.forEach(group => {
            const startIndex = rows.findIndex(row => row.dataset.id === group.startId);
            const endIndex = rows.findIndex(row => row.dataset.id === group.endId);
            if (startIndex !== -1 && endIndex !== -1 && startIndex <= endIndex) {
                // Check if the group already exists in the DOM to avoid duplication
                const firstRow = rows[startIndex];
                if (firstRow.firstChild.tagName === 'TD' && !firstRow.firstChild.querySelector('input')) {
                    const groupCell = document.createElement('td');
                    groupCell.className = 'p-2 border bg-gray-300 font-bold';
                    groupCell.style.writingMode = 'vertical-rl';
                    groupCell.style.transform = 'rotate(180deg)';
                    groupCell.style.textAlign = 'center';
                    groupCell.style.height = `${(endIndex - startIndex + 1) * 40}px`; // Approximate row height
                    groupCell.rowSpan = endIndex - startIndex + 1;
                    groupCell.innerHTML = `<input type="text" class="w-full h-full bg-gray-300 border-none focus:outline-none text-center font-bold" value="${group.name}" placeholder="Group Name">`;

                    firstRow.insertBefore(groupCell, firstRow.firstChild);
                    for (let i = startIndex + 1; i <= endIndex; i++) {
                        rows[i].removeChild(rows[i].firstChild);
                    }

                    // Add Enter key listener to save group name
                    const groupInput = groupCell.querySelector('input');
                    groupInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            group.name = groupInput.value || `Group ${groups.length + 1}`;
                            finishGrouping();
                        }
                    });
                }
            }
        });
    }

    // --- Check if Rows are Consecutive ---
    function areRowsConsecutive() {
        if (selectedInterpreterIds.size <= 1) return true;
        const rows = Array.from(rosterList.querySelectorAll('tr:not(.header-row)'));
        const selectedIndices = Array.from(selectedInterpreterIds).map(id =>
            rows.findIndex(row => row.dataset.id === id)
        ).sort((a, b) => a - b);

        for (let i = 1; i < selectedIndices.length; i++) {
            if (selectedIndices[i] !== selectedIndices[i - 1] + 1) {
                return false;
            }
        }
        return true;
    }

    // --- Finish Grouping ---
    function finishGrouping() {
        isGroupingMode = false;
        isFinishGroupingMode = false;
        groupBtn.textContent = 'Group';
        groupBtn.classList.remove('bg-yellow-500', 'hover:bg-yellow-600', 'bg-green-500', 'hover:bg-green-600');
        groupBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
        selectedInterpreterIds.clear();
        rosterList.querySelectorAll('tr').forEach(row => row.classList.remove('selected'));
        updateRowNumbers();
        applyGroups(); // Ensure groups are reapplied
    }

    // --- Group Button Functionality ---
    groupBtn.addEventListener('click', () => {
        if (!isGroupingMode && !isFinishGroupingMode) {
            // Enter Grouping mode
            isGroupingMode = true;
            groupBtn.textContent = 'Group Selected';
            groupBtn.classList.add('bg-green-500', 'hover:bg-green-600');
            groupBtn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
            alert('Entered Grouping mode. Select consecutive rows and click "Group Selected".');
        } else if (isGroupingMode) {
            // Perform grouping
            if (selectedInterpreterIds.size === 0) {
                alert('Please select at least one interpreter to group.');
                return;
            }

            if (!areRowsConsecutive()) {
                alert('Please select consecutive rows only (e.g., rows 1-3, not rows 1 and 3).');
                selectedInterpreterIds.clear();
                rosterList.querySelectorAll('tr').forEach(row => row.classList.remove('selected'));
                return;
            }

            // Add group column only if this is the first group
            if (!hasGroupColumn) {
                addGroupColumn();
            }

            const rows = Array.from(rosterList.querySelectorAll('tr:not(.header-row)'));
            const selectedRows = Array.from(selectedInterpreterIds).map(id =>
                rows.find(row => row.dataset.id === id)
            ).sort((a, b) => rows.indexOf(a) - rows.indexOf(b));

            const firstRow = selectedRows[0];
            const firstRowIndex = rows.indexOf(firstRow);
            const lastRow = selectedRows[selectedRows.length - 1];

            // Add header row if not the first interpreter row and no header exists above
            if (firstRowIndex > 0 && (!firstRow.previousElementSibling || !firstRow.previousElementSibling.classList.contains('header-row'))) {
                const headerRow = document.createElement('tr');
                headerRow.className = 'header-row bg-gray-200';
                headerRow.innerHTML = tableHeadRow.innerHTML;
                rosterList.insertBefore(headerRow, firstRow);
            }

            // Merge cells in the group column
            const groupCell = document.createElement('td');
            groupCell.className = 'p-2 border bg-gray-300 font-bold';
            groupCell.style.writingMode = 'vertical-rl';
            groupCell.style.transform = 'rotate(180deg)';
            groupCell.style.textAlign = 'center';
            groupCell.style.height = `${selectedRows.length * 40}px`; // Approximate row height
            groupCell.rowSpan = selectedRows.length;
            groupCell.innerHTML = `<input type="text" class="w-full h-full bg-gray-300 border-none focus:outline-none text-center font-bold" placeholder="Group Name">`;

            firstRow.insertBefore(groupCell, firstRow.firstChild);
            for (let i = 1; i < selectedRows.length; i++) {
                selectedRows[i].removeChild(selectedRows[i].firstChild);
            }

            // Add Enter key listener to finish grouping
            const groupInput = groupCell.querySelector('input');
            groupInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    groups.push({ startId: firstRow.dataset.id, endId: lastRow.dataset.id, name: groupInput.value || `Group ${groups.length + 1}` });
                    finishGrouping();
                }
            });

            // Move to Finish Grouping mode
            isGroupingMode = false;
            isFinishGroupingMode = true;
            groupBtn.textContent = 'Finish Grouping';
            groupBtn.classList.remove('bg-green-500', 'hover:bg-green-600');
            groupBtn.classList.add('bg-yellow-500', 'hover:bg-yellow-600');
            selectedInterpreterIds.clear();
            rosterList.querySelectorAll('tr').forEach(row => row.classList.remove('selected'));
        } else if (isFinishGroupingMode) {
            // Finish Grouping mode
            const currentInput = rosterList.querySelector('input:focus');
            if (currentInput) {
                const groupCell = currentInput.closest('td');
                const groupName = currentInput.value || `Group ${groups.length + 1}`;
                const startRow = groupCell.parentElement;
                let endRow = startRow;
                let rowSpan = groupCell.rowSpan;
                while (endRow.nextElementSibling && rowSpan > 1) {
                    endRow = endRow.nextElementSibling;
                    rowSpan--;
                    if (endRow.classList.contains('header-row')) continue;
                }
                groups.push({ startId: startRow.dataset.id, endId: endRow.dataset.id, name: groupName });
            }
            finishGrouping();
        }
    });

    // --- Event Dropdown Change ---
    eventDropdown.addEventListener('change', () => {
        selectedInterpreterIds.clear();
        isGroupingMode = false;
        isFinishGroupingMode = false;
        hasGroupColumn = false;
        groups = [];
        groupBtn.textContent = 'Group';
        groupBtn.classList.remove('bg-green-500', 'hover:bg-green-600', 'bg-yellow-500', 'hover:bg-yellow-600');
        groupBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
        while (tableHeadRow.firstChild.tagName === 'TH' && tableHeadRow.firstChild.textContent === '') {
            tableHeadRow.removeChild(tableHeadRow.firstChild);
        }
        updateRosterTable();
    });

    // --- Initialize ---
    loadData();
});