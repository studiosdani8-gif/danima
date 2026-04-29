// ============================================
// VARIABLES GLOBALES
// ============================================
let currentUser = null;
let currentUserData = null;

// ============================================
// VERIFICAR SESIÓN
// ============================================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        
        try {
            const userDoc = await db.collection(COLLECTIONS.USERS).doc(user.uid).get();
            
            if (userDoc.exists) {
                currentUserData = userDoc.data();
            } else {
                const userData = {
                    name: user.email.split('@')[0],
                    email: user.email,
                    role: 'user',
                    avatar: '',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    preferences: {
                        language: 'es',
                        notifications: true,
                        autoplay: true
                    }
                };
                await db.collection(COLLECTIONS.USERS).doc(user.uid).set(userData);
                currentUserData = userData;
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
        
        const path = window.location.pathname;
        const isAdmin = currentUserData?.role === 'admin';
        
        if (path.includes('login.html')) {
            if (isAdmin) {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'index.html';
            }
        }
        
        if (isAdmin && !path.includes('admin.html') && !path.includes('login.html')) {
            const adminBtn = document.querySelector('.nav-menu a[href="admin.html"]');
            if (!adminBtn && !path.includes('admin.html')) {
                const navMenu = document.querySelector('.nav-menu');
                if (navMenu) {
                    const adminLink = document.createElement('a');
                    adminLink.href = 'admin.html';
                    adminLink.innerHTML = '<i class="fas fa-cog"></i> Admin';
                    navMenu.appendChild(adminLink);
                }
            }
        }
        
        updateUserUI();
        
    } else if (!window.location.pathname.includes('login.html')) {
        window.location.href = 'login.html';
    }
});

// ============================================
// ACTUALIZAR UI DEL USUARIO
// ============================================
function updateUserUI() {
    if (!currentUserData) return;
    
    const userNameElements = document.querySelectorAll('.user-name');
    const userAvatarElements = document.querySelectorAll('#userAvatar, .user-avatar, #profileAvatar');
    
    userNameElements.forEach(el => {
        if (el) el.textContent = currentUserData.name;
    });
    
    userAvatarElements.forEach(el => {
        if (el) {
            if (currentUserData.avatar) {
                el.src = currentUserData.avatar;
            } else {
                el.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserData.name)}&background=e50914&color=fff`;
            }
        }
    });
    
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profileRole = document.getElementById('profileRole');
    const profileFullName = document.getElementById('profileFullName');
    const profileEmailInput = document.getElementById('profileEmailInput');
    
    if (profileName) profileName.textContent = currentUserData.name;
    if (profileEmail) profileEmail.textContent = currentUserData.email;
    if (profileRole) profileRole.textContent = currentUserData.role;
    if (profileFullName) profileFullName.value = currentUserData.name;
    if (profileEmailInput) profileEmailInput.value = currentUserData.email;
    
    const prefLanguage = document.getElementById('prefLanguage');
    const prefNotifications = document.getElementById('prefNotifications');
    const prefAutoplay = document.getElementById('prefAutoplay');
    
    if (prefLanguage && currentUserData.preferences) {
        prefLanguage.value = currentUserData.preferences.language || 'es';
        prefNotifications.checked = currentUserData.preferences.notifications !== false;
        prefAutoplay.checked = currentUserData.preferences.autoplay !== false;
    }
}

// ============================================
// INICIAR SESIÓN
// ============================================
window.login = async function(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        showNotification('¡Bienvenido de vuelta!', 'success');
        return { success: true, user: userCredential.user };
    } catch (error) {
        let message = 'Error al iniciar sesión';
        switch (error.code) {
            case 'auth/user-not-found':
                message = 'Usuario no encontrado';
                break;
            case 'auth/wrong-password':
                message = 'Contraseña incorrecta';
                break;
            case 'auth/invalid-email':
                message = 'Email inválido';
                break;
            case 'auth/too-many-requests':
                message = 'Demasiados intentos. Intenta más tarde';
                break;
        }
        showNotification(message, 'error');
        return { success: false, error: message };
    }
};

// ============================================
// REGISTRAR USUARIO
// ============================================
window.register = async function(name, email, password) {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        
        await db.collection(COLLECTIONS.USERS).doc(userCredential.user.uid).set({
            name: name,
            email: email,
            role: 'user',
            avatar: '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            preferences: {
                language: 'es',
                notifications: true,
                autoplay: true
            }
        });
        
        showNotification('¡Registro exitoso!', 'success');
        return { success: true };
    } catch (error) {
        let message = 'Error al registrar';
        if (error.code === 'auth/email-already-in-use') {
            message = 'El email ya está registrado';
        }
        showNotification(message, 'error');
        return { success: false, error: message };
    }
};

// ============================================
// CERRAR SESIÓN
// ============================================
window.logout = async function() {
    try {
        await auth.signOut();
        showNotification('Sesión cerrada', 'success');
        window.location.href = 'login.html';
    } catch (error) {
        showNotification('Error al cerrar sesión', 'error');
    }
};

// ============================================
// RECUPERAR CONTRASEÑA
// ============================================
window.resetPassword = async function(email) {
    try {
        await auth.sendPasswordResetEmail(email);
        showNotification('Revisa tu email para restablecer la contraseña', 'success');
        return { success: true };
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
        return { success: false };
    }
};

// ============================================
// ACTUALIZAR PERFIL
// ============================================
window.updateProfile = async function(name, newPassword, confirmPassword) {
    if (!currentUser) return { success: false };
    
    try {
        const updates = { name: name };
        
        if (newPassword) {
            if (newPassword !== confirmPassword) {
                showNotification('Las contraseñas no coinciden', 'error');
                return { success: false };
            }
            await currentUser.updatePassword(newPassword);
        }
        
        await db.collection(COLLECTIONS.USERS).doc(currentUser.uid).update(updates);
        currentUserData.name = name;
        updateUserUI();
        showNotification('Perfil actualizado', 'success');
        return { success: true };
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
        return { success: false };
    }
};

// ============================================
// ACTUALIZAR PREFERENCIAS
// ============================================
window.updatePreferences = async function(language, notifications, autoplay) {
    if (!currentUser) return;
    
    try {
        await db.collection(COLLECTIONS.USERS).doc(currentUser.uid).update({
            preferences: {
                language: language,
                notifications: notifications,
                autoplay: autoplay
            }
        });
        showNotification('Preferencias guardadas', 'success');
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
};

// ============================================
// CAMBIAR AVATAR
// ============================================
window.changeAvatar = async function(file) {
    if (!currentUser || !file) return;
    
    try {
        const storageRef = storage.ref();
        const avatarRef = storageRef.child(`avatars/${currentUser.uid}`);
        await avatarRef.put(file);
        const avatarUrl = await avatarRef.getDownloadURL();
        
        await db.collection(COLLECTIONS.USERS).doc(currentUser.uid).update({
            avatar: avatarUrl
        });
        
        currentUserData.avatar = avatarUrl;
        updateUserUI();
        showNotification('Avatar actualizado', 'success');
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
};

// ============================================
// EVENT LISTENERS
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
    
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            await login(email, password);
        });
    }
    
    // Register form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            if (password !== confirmPassword) {
                showNotification('Las contraseñas no coinciden', 'error');
                return;
            }
            
            await register(name, email, password);
        });
    }
    
    // Forgot password
    const forgotBtn = document.getElementById('forgotPassword');
    if (forgotBtn) {
        forgotBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = prompt('Ingresa tu email:');
            if (email) await resetPassword(email);
        });
    }
    
    // Profile form
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('profileFullName').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmNewPassword').value;
            await updateProfile(name, newPassword, confirmPassword);
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmNewPassword').value = '';
        });
    }
    
    // Preferences form
    const preferencesForm = document.getElementById('preferencesForm');
    if (preferencesForm) {
        preferencesForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const language = document.getElementById('prefLanguage').value;
            const notifications = document.getElementById('prefNotifications').checked;
            const autoplay = document.getElementById('prefAutoplay').checked;
            await updatePreferences(language, notifications, autoplay);
        });
    }
    
    // Profile tabs
    const profileTabs = document.querySelectorAll('.profile-tab');
    profileTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.profile-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${tabName}Tab`).classList.add('active');
        });
    });
    
    // Auth tabs
    const authTabs = document.querySelectorAll('.auth-tabs .tab-btn');
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
            document.getElementById(`${tabName}-form`).classList.add('active');
            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });
});