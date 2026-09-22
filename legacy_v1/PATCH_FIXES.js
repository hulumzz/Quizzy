/**
 * ========================================
 * QUIZZY BUG FIXES - PATCH FILE
 * ========================================
 * 
 * Cara Pakai:
 * 1. Buka file public/index.html
 * 2. Cari kode yang sesuai dengan "FIND:" di bawah
 * 3. Ganti dengan kode "REPLACE:"
 * 
 * Atau copy-paste fungsi yang sudah diperbaiki langsung
 * ========================================
 */

// ========================================
// FIX #1: Double window.onload
// ========================================
// FIND (di baris terakhir):
/*
window.onload = app.auth.init;
window.onload = app.auth.init;
*/

// REPLACE:
window.addEventListener('DOMContentLoaded', () => {
    app.auth.init();
});


// ========================================
// FIX #2: Global Cleanup Function
// ========================================
// TAMBAHKAN setelah window.app = {

const globalCleanup = {
    all: () => {
        console.log("🧹 Cleaning up resources...");
        
        // Clear timers
        if (window.app.host.timerInterval) {
            clearInterval(window.app.host.timerInterval);
            window.app.host.timerInterval = null;
        }
        if (window.app.host.tauntTimer) {
            clearInterval(window.app.host.tauntTimer);
            window.app.host.tauntTimer = null;
        }
        
        // Unsubscribe listeners
        if (window.app.host.listeners && window.app.host.listeners.length > 0) {
            window.app.host.listeners.forEach(unsub => {
                try { unsub(); } catch(e) { console.warn("Listener cleanup:", e); }
            });
            window.app.host.listeners = [];
        }
        
        if (window.app.studio.listener) {
            try { window.app.studio.listener(); } catch(e) {}
            window.app.studio.listener = null;
        }
        
        if (window.app.student.listenerUnsub) {
            try { window.app.student.listenerUnsub(); } catch(e) {}
            window.app.student.listenerUnsub = null;
        }
        
        // Clear DOM
        ['host-answers-grid', 'v-options', 'seq-container'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
        
        // Clear player chips
        document.querySelectorAll('.player-chip').forEach(chip => chip.remove());
        
        // Reset flags
        if (window.app.host) window.app.host.isEnding = false;
        if (window.app.student) window.app.student.isSubmitting = false;
        if (window.app.ai) window.app.ai.isGenerating = false;
        
        console.log("✅ Cleanup complete");
    }
};


// ========================================
// FIX #3: Improved Router with Cleanup
// ========================================
const improvedRouter = (pid) => {
    // Cleanup sebelum pindah page
    if (pid !== 'play' && pid !== 'host') {
        globalCleanup.all();
    }
    
    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
    const t = document.getElementById(`page-${pid}`);
    if(t) t.classList.add('active');
    
    if(pid === 'studio' && window.app.user && !window.app.user.isAnonymous) {
        window.app.studio.init();
    }
    if(pid === 'admin') {
        window.app.admin.init();
    }
};


// ========================================
// FIX #4: Host endQuestion with Guard
// ========================================
const improvedEndQuestion = async function() {
    // Guard: Prevent double call
    if (this.isEnding) {
        console.log("⚠️ endQuestion already running, skipping...");
        return;
    }
    this.isEnding = true;
    
    if(this.tauntTimer) clearInterval(this.tauntTimer);
    if(this.timerInterval) clearInterval(this.timerInterval);
    
    const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
    
    await updateDoc(doc(window.db, `artifacts/${window.appInfo.id}/public/data/quizzy`, this.pin), {
        status: 'revealed'
    });
    
    this.listeners.forEach(u => {
        try { u(); } catch(e) {}
    });
    this.listeners = [];
    
    const q = this.data.questions[this.currentQIndex];
    
    if(this.mode !== 'monster') {
        if(['multiple_choice','shape','image_choice'].includes(q.type)) {
            [0,1,2,3].forEach(i => {
                if(i !== q.correctIndex) {
                    const bucket = document.getElementById(`bucket-${i}`);
                    if (bucket) bucket.classList.add('opacity-20');
                }
            });
        }
    }
    
    if (typeof setMascot === 'function') {
        setMascot('happy', "Yey!");
    }
    
    setTimeout(() => {
        const gameplay = document.getElementById('stage-gameplay-container');
        const question = document.getElementById('shared-question-display');
        
        if (gameplay) gameplay.classList.add('hidden');
        if (question) question.classList.add('hidden');
        
        if(this.mode === 'monster') {
            this.showMonsterResult();
        } else {
            this.showLeaderboard();
        }
        
        this.isEnding = false; // Release lock
    }, 5000);
};


// ========================================
// FIX #5: Student joinGame with Cleanup
// ========================================
const improvedJoinGame = async function() {
    const pin = document.getElementById('input-pin').value;
    const name = document.getElementById('input-name').value;
    
    if(!pin || !name) {
        if (typeof notify === 'function') {
            notify("Info", "Mohon lengkapi PIN dan Nama", "info");
        }
        return;
    }
    
    // ✅ CLEANUP: Hapus semua session data game sebelumnya
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith('ans_') || key.startsWith('score_') || key.startsWith('corr_'))) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(k => sessionStorage.removeItem(k));
    
    console.log("🧹 Cleaned", keysToRemove.length, "old session keys");
    
    // ✅ NULL CHECK
    const { getDoc, doc, setDoc, signInAnonymously } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
    const g = await getDoc(doc(window.db, `artifacts/${window.appInfo.id}/public/data/quizzy`, pin));
    
    if(!g.exists()) {
        if (typeof notify === 'function') {
            notify("Gagal", "PIN tidak ditemukan.", "error");
        }
        return;
    }
    
    const gameData = g.data();
    if(!gameData) {
        if (typeof notify === 'function') {
            notify("Error", "Data game tidak valid.", "error");
        }
        return;
    }
    
    if(gameData.status === 'ended') {
        if (typeof notify === 'function') {
            notify("Maaf", "Game sudah berakhir.", "warning");
        }
        return;
    }
    
    await signInAnonymously(window.auth);
    this.myID = window.auth.currentUser.uid;
    this.pin = pin;
    this.name = name;
    
    sessionStorage.setItem('last_pin', pin);
    sessionStorage.setItem('last_name', name);
    
    if(gameData.quizData) {
        this.quizData = gameData.quizData;
        this.preloadImages();
    } else {
        const qDoc = await getDoc(doc(window.db, `artifacts/${window.appInfo.id}/users/${gameData.hostId}/quizzes`, gameData.quizId));
        if (qDoc.exists()) {
            this.quizData = qDoc.data();
            this.preloadImages();
        }
    }
    
    await setDoc(doc(window.db, `artifacts/${window.appInfo.id}/public/data/quizzy`, pin, 'players', this.myID), {
        name,
        score: 0
    });
    
    const initialEl = document.getElementById('st-initial');
    const nameEl = document.getElementById('st-name');
    
    if (initialEl) initialEl.innerText = name.substr(0,1).toUpperCase();
    if (nameEl) nameEl.innerText = name;
    
    if (typeof window.app.router === 'function') {
        window.app.router('play');
    }
    this.listen();
};


// ========================================
// FIX #6: QR Scanner Close (Safe)
// ========================================
const improvedCloseScanner = async function() {
    if (this.isScannerBusy) {
        const container = document.getElementById('scanner-container');
        if (container) {
            container.classList.add('hidden');
            container.classList.remove('flex');
        }
        return;
    }

    const container = document.getElementById('scanner-container');
    if (container) {
        container.classList.add('hidden');
        container.classList.remove('flex');
    }

    if (this.html5QrcodeScanner) {
        try {
            // Simple try-catch tanpa state check
            await this.html5QrcodeScanner.stop();
            this.html5QrcodeScanner.clear();
        } catch (err) {
            console.warn("Scanner cleanup (safe to ignore):", err);
            // Force clear jika stop gagal
            try {
                this.html5QrcodeScanner.clear();
            } catch(e) {
                console.warn("Force clear failed:", e);
            }
        }
        this.html5QrcodeScanner = null;
    }
};


// ========================================
// FIX #7: Upload with Timeout
// ========================================
