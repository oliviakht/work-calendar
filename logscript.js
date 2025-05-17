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

    // --- Real-Time Logs Listener ---
    const logList = document.getElementById('logList');
    function setupLogsListener() {
        db.collection('logs')
            .orderBy('timestamp', 'desc')
            .limit(50)
            .onSnapshot(snapshot => {
                logList.innerHTML = '';
                snapshot.forEach(doc => {
                    const log = doc.data();
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="p-2 border">${new Date(log.timestamp).toLocaleString()}</td>
                        <td class="p-2 border">${log.action}</td>
                        <td class="p-2 border">${log.details}</td>
                        <td class="p-2 border">${log.user}</td>
                    `;
                    logList.appendChild(row);
                });
            });
    }

    // --- Clear All Logs Function ---
    const clearAllBtn = document.getElementById('clearAllBtn');
    clearAllBtn.addEventListener('click', async function () {
        if (confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
            const snapshot = await db.collection('logs').get();
            const deletePromises = snapshot.docs.map(doc => doc.ref.delete());
            await Promise.all(deletePromises);
        }
    });

    // Initialize the listener
    setupLogsListener();
});