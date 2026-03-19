var appState = {
    isReady: false,
    secureStorage: null
};

var actionHandlers = {
    "device-refresh": refreshDeviceInfo,
    "dialogs-alert": testDialogAlert,
    "dialogs-confirm": testDialogConfirm,
    "dialogs-beep": testDialogBeep,
    "geo-current": testGeolocation,
    "diagnostic-location-status": checkDiagnosticLocation,
    "diagnostic-location-request": requestDiagnosticLocation,
    "diagnostic-notification-status": checkDiagnosticNotifications,
    "background-enable": enableBackgroundMode,
    "background-disable": disableBackgroundMode,
    "fullscreen-enter": enterFullscreen,
    "fullscreen-reset": resetFullscreen,
    "statusbar-show": showStatusBar,
    "statusbar-hide": hideStatusBar,
    "statusbar-color": colorStatusBar,
    "secure-set": secureSetSample,
    "secure-get": secureGetSample,
    "secure-remove": secureRemoveSample,
    "log-clear": clearLog
};

document.addEventListener("DOMContentLoaded", onDomReady, false);
document.addEventListener("deviceready", onDeviceReady, false);

function onDomReady() {
    document.body.addEventListener("click", onActionClick, false);
    writeLog("DOM siap. Menunggu event deviceready dari Cordova.");
}

function onDeviceReady() {
    appState.isReady = true;

    setBadge("ready-badge", "Cordova siap", "ok");
    setBadge("platform-badge", "Platform " + getPlatformName(), "soft");

    refreshDeviceInfo();
    setupFirebaseNotifications();
    initBackgroundModeEvents();
    initLocalNotificationListeners();
    createSecureStorage();
    fetchAndLogFirebaseToken();

    writeLog("Device ready aktif. Plugin utama sudah diinisialisasi.");
}

function onActionClick(event) {
    var button = event.target.closest("button[data-action]");
    var action;

    if (!button) {
        return;
    }

    action = button.getAttribute("data-action");

    if (!actionHandlers[action]) {
        return;
    }

    if (!appState.isReady && action !== "log-clear") {
        writeLog("Tombol diabaikan karena deviceready belum aktif.");
        return;
    }

    try {
        actionHandlers[action]();
    } catch (error) {
        writeLog("Error action " + action + ": " + formatError(error));
    }
}

function refreshDeviceInfo() {
    var items = [
        "Status Cordova: " + (window.cordova ? "aktif" : "tidak aktif"),
        "Platform: " + getPlatformName(),
        "Versi Cordova: " + (window.cordova ? cordova.version : "tidak tersedia"),
        "Model Device: " + (window.device ? device.model : "plugin-device belum tersedia")
    ];

    renderList("runtime-info", items);
    setPanelStatus("status-device", window.device ? "Terdeteksi" : "Belum aktif", window.device ? "ok" : "warn");
    writeLog("Device info diperbarui.");
}

function testDialogAlert() {
    if (!navigator.notification || !navigator.notification.alert) {
        setPanelStatus("status-dialogs", "Plugin tidak tersedia", "error");
        writeLog("Dialogs tidak tersedia.");
        return;
    }

    navigator.notification.alert(
        "Plugin dialog berhasil dipanggil.",
        function () {
            setPanelStatus("status-dialogs", "Alert berhasil", "ok");
            writeLog("Dialog alert berhasil ditampilkan.");
        },
        "ctech-mobile",
        "OK"
    );
}

function testDialogConfirm() {
    if (!navigator.notification || !navigator.notification.confirm) {
        setPanelStatus("status-dialogs", "Plugin tidak tersedia", "error");
        writeLog("Dialogs confirm tidak tersedia.");
        return;
    }

    navigator.notification.confirm(
        "Apakah plugin confirm berjalan?",
        function (buttonIndex) {
            setPanelStatus("status-dialogs", "Confirm aktif", "ok");
            writeLog("Dialog confirm dipilih tombol index: " + buttonIndex);
        },
        "Uji Confirm",
        ["Ya", "Tidak"]
    );
}

function testDialogBeep() {
    if (!navigator.notification || !navigator.notification.beep) {
        setPanelStatus("status-dialogs", "Plugin tidak tersedia", "error");
        writeLog("Dialogs beep tidak tersedia.");
        return;
    }

    navigator.notification.beep(1);
    setPanelStatus("status-dialogs", "Beep dipanggil", "ok");
    writeLog("Beep 1x dijalankan.");
}

function testGeolocation() {
    if (!navigator.geolocation || !navigator.geolocation.getCurrentPosition) {
        setPanelStatus("status-geolocation", "Plugin tidak tersedia", "error");
        writeLog("Geolocation tidak tersedia.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        function (position) {
            setPanelStatus("status-geolocation", "Lokasi didapat", "ok");
            writeLog(
                "Lokasi: lat " +
                position.coords.latitude +
                ", lng " +
                position.coords.longitude +
                ", akurasi " +
                position.coords.accuracy
            );
        },
        function (error) {
            setPanelStatus("status-geolocation", "Gagal ambil lokasi", "error");
            writeLog("Geolocation error: " + formatError(error));
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        }
    );
}

function checkDiagnosticLocation() {
    var diagnostic = getDiagnostic();

    if (!diagnostic || !diagnostic.location || !diagnostic.location.isLocationEnabled) {
        setPanelStatus("status-diagnostic", "Plugin tidak tersedia", "error");
        writeLog("Diagnostic location tidak tersedia.");
        return;
    }

    diagnostic.location.isLocationEnabled(
        function (enabled) {
            setPanelStatus("status-diagnostic", enabled ? "Lokasi aktif" : "Lokasi nonaktif", enabled ? "ok" : "warn");
            writeLog("Diagnostic lokasi aktif: " + enabled);
        },
        function (error) {
            setPanelStatus("status-diagnostic", "Gagal cek lokasi", "error");
            writeLog("Diagnostic location error: " + formatError(error));
        }
    );
}

function requestDiagnosticLocation() {
    var diagnostic = getDiagnostic();

    if (!diagnostic || !diagnostic.location || !diagnostic.location.requestLocationAuthorization) {
        setPanelStatus("status-diagnostic", "Plugin tidak tersedia", "error");
        writeLog("Diagnostic request location tidak tersedia.");
        return;
    }

    diagnostic.location.requestLocationAuthorization(
        function (status) {
            setPanelStatus("status-diagnostic", "Izin lokasi: " + status, "ok");
            writeLog("Hasil izin lokasi diagnostic: " + status);
        },
        function (error) {
            setPanelStatus("status-diagnostic", "Gagal minta izin", "error");
            writeLog("Request location authorization error: " + formatError(error));
        },
        diagnostic.location.locationAuthorizationMode.WHEN_IN_USE
    );
}

function checkDiagnosticNotifications() {
    var diagnostic = getDiagnostic();

    if (!diagnostic || !diagnostic.notifications || !diagnostic.notifications.isRemoteNotificationsEnabled) {
        setPanelStatus("status-diagnostic", "Plugin tidak tersedia", "error");
        writeLog("Diagnostic notifications tidak tersedia.");
        return;
    }

    diagnostic.notifications.isRemoteNotificationsEnabled(
        function (enabled) {
            setPanelStatus("status-diagnostic", enabled ? "Notif aktif" : "Notif nonaktif", enabled ? "ok" : "warn");
            writeLog("Diagnostic remote notifications aktif: " + enabled);
        },
        function (error) {
            setPanelStatus("status-diagnostic", "Gagal cek notif", "error");
            writeLog("Diagnostic notifications error: " + formatError(error));
        }
    );
}

function setupFirebaseNotifications() {
    var firebase = getFirebasePlugin();
    var local = getLocalNotification();

    if (!firebase) {
        setPanelStatus("status-firebase", "Plugin tidak tersedia", "error");
        writeLog("Firebase plugin belum tersedia. Setup notifikasi dilewati.");
        return;
    }

    setPanelStatus("status-firebase", "Inisialisasi notifikasi", "warn");

    if (firebase.hasPermission) {
        firebase.hasPermission(
            function (granted) {
                writeLog("Firebase permission aktif: " + granted);
                if (!granted && firebase.grantPermission) {
                    firebase.grantPermission(
                        function () {
                            writeLog("Izin push Firebase diproses saat startup.");
                        },
                        function (error) {
                            writeLog("Gagal meminta izin push Firebase saat startup: " + formatError(error));
                        }
                    );
                }
            },
            function (error) {
                writeLog("Gagal mengecek izin push Firebase: " + formatError(error));
            }
        );
    }

    if (firebase.createChannel) {
        firebase.createChannel(
            {
                id: "fcm_default_channel",
                name: "ctech Mobile Notifications",
                description: "Notifikasi default dari ctech mobile",
                importance: 4,
                sound: "notif",
                lights: true,
                vibration: true,
                smallIcon: "notification_icon"
            },
            function () {
                setPanelStatus("status-firebase", "Channel notifikasi siap", "ok");
                writeLog("Channel Firebase default siap dengan sound notif dan logo aplikasi.");

                if (firebase.setDefaultChannel) {
                    firebase.setDefaultChannel(
                        { id: "fcm_default_channel" },
                        function () {
                            writeLog("Default channel berhasil di-set.");
                        },
                        function (error) {
                            writeLog("Gagal set default channel: " + formatError(error));
                        }
                    );
                }
            },
            function (error) {
                writeLog("Gagal membuat default Firebase channel: " + formatError(error));
            }
        );
    }

    if (firebase.onMessageReceived) {
        firebase.onMessageReceived(
            function (message) {
                var isForegroundMessage = !message || !message.tap;

                writeLog("Firebase message diterima: " + stringify(message));

                if (isForegroundMessage && local && messageHasVisibleContent(message)) {
                    showLocalNotificationFromFirebase(message);
                    setPanelStatus("status-local-notification", "Notif foreground aktif", "ok");
                } else if (!isForegroundMessage) {
                    writeLog("Push notification dibuka dari tray sistem.");
                }
            },
            function (error) {
                writeLog("Firebase onMessageReceived error: " + formatError(error));
            }
        );
    }
    setPanelStatus(
        "status-local-notification",
        local ? "Siap untuk notif foreground" : "Plugin tidak tersedia",
        local ? "ok" : "error"
    );
    writeLog("Saat aplikasi tertutup, notifikasi tetap harus dikirim dari payload FCM native agar muncul dari sistem Android.");
}

function fetchAndLogFirebaseToken() {
    var firebase = getFirebasePlugin();

    if (!firebase || !firebase.getToken) {
        writeLog("Firebase token tidak bisa diambil karena plugin belum tersedia.");
        return;
    }

    firebase.getToken(
        function (token) {
            if (!token) {
                writeLog("Firebase token kosong.");
                return;
            }

            setPanelStatus("status-firebase", "Token siap dipakai", "ok");
            writeLog("Firebase token device: " + token);
        },
        function (error) {
            writeLog("Gagal mengambil Firebase token: " + formatError(error));
        }
    );
}

function showLocalNotificationFromFirebase(firebaseMessage) {
    var local = getLocalNotification();
    var payload = firebaseMessage.additionalData || {};
    var title = firebaseMessage.title || payload.title || "ctech-mobile";
    var body = firebaseMessage.body || firebaseMessage.message || payload.body || payload.message || "Notifikasi baru";

    if (!local || !local.schedule) {
        writeLog("Local notification tidak tersedia untuk menampilkan pesan Firebase di foreground.");
        return;
    }

    local.schedule({
        id: Date.now(),
        title: title,
        text: body,
        trigger: { at: new Date(Date.now() + 250) },
        sound: "res://notif.mp3",
        smallIcon: "res://drawable/notification_icon",
        icon: "res://drawable/notification_icon_large",
        androidChannelId: "fcm_default_channel",
        data: payload
    });

    writeLog("Pesan Firebase foreground diubah menjadi local notification dengan logo aplikasi.");
}

function enableBackgroundMode() {
    var mode = getBackgroundMode();

    if (!mode || !mode.enable) {
        setPanelStatus("status-background", "Plugin tidak tersedia", "error");
        writeLog("Background mode tidak tersedia.");
        return;
    }

    mode.setDefaults({
        title: "ctech-mobile aktif",
        text: "Background mode sedang berjalan"
    });
    mode.enable();

    setPanelStatus("status-background", "Background aktif", "ok");
    writeLog("Background mode diaktifkan.");
}

function disableBackgroundMode() {
    var mode = getBackgroundMode();

    if (!mode || !mode.disable) {
        setPanelStatus("status-background", "Plugin tidak tersedia", "error");
        writeLog("Background mode tidak tersedia.");
        return;
    }

    mode.disable();
    setPanelStatus("status-background", "Background nonaktif", "warn");
    writeLog("Background mode dinonaktifkan.");
}

function enterFullscreen() {
    if (!window.AndroidFullScreen || !AndroidFullScreen.immersiveMode) {
        setPanelStatus("status-fullscreen", "Plugin tidak tersedia", "error");
        writeLog("AndroidFullScreen tidak tersedia.");
        return;
    }

    AndroidFullScreen.immersiveMode(
        function () {
            setPanelStatus("status-fullscreen", "Immersive aktif", "ok");
            writeLog("Immersive mode aktif.");
        },
        function (error) {
            setPanelStatus("status-fullscreen", "Gagal immersive", "error");
            writeLog("Fullscreen immersive error: " + formatError(error));
        }
    );
}

function resetFullscreen() {
    if (!window.AndroidFullScreen || !AndroidFullScreen.resetScreen) {
        setPanelStatus("status-fullscreen", "Plugin tidak tersedia", "error");
        writeLog("AndroidFullScreen reset tidak tersedia.");
        return;
    }

    AndroidFullScreen.resetScreen(
        function () {
            setPanelStatus("status-fullscreen", "Screen normal", "ok");
            writeLog("Fullscreen reset berhasil.");
        },
        function (error) {
            setPanelStatus("status-fullscreen", "Reset gagal", "error");
            writeLog("Fullscreen reset error: " + formatError(error));
        }
    );
}

function showStatusBar() {
    if (!window.StatusBar || !StatusBar.show) {
        setPanelStatus("status-statusbar", "Plugin tidak tersedia", "error");
        writeLog("StatusBar tidak tersedia.");
        return;
    }

    StatusBar.show();
    setPanelStatus("status-statusbar", "StatusBar tampil", "ok");
    writeLog("StatusBar.show dipanggil.");
}

function hideStatusBar() {
    if (!window.StatusBar || !StatusBar.hide) {
        setPanelStatus("status-statusbar", "Plugin tidak tersedia", "error");
        writeLog("StatusBar tidak tersedia.");
        return;
    }

    StatusBar.hide();
    setPanelStatus("status-statusbar", "StatusBar disembunyikan", "ok");
    writeLog("StatusBar.hide dipanggil.");
}

function colorStatusBar() {
    if (!window.StatusBar || !StatusBar.backgroundColorByHexString) {
        setPanelStatus("status-statusbar", "Plugin tidak tersedia", "error");
        writeLog("StatusBar color tidak tersedia.");
        return;
    }

    StatusBar.backgroundColorByHexString("#177B52");
    StatusBar.styleLightContent();
    setPanelStatus("status-statusbar", "Warna diubah", "ok");
    writeLog("Warna StatusBar diubah ke #177B52.");
}

function createSecureStorage() {
    if (!window.SecureStorage) {
        setPanelStatus("status-secure-storage", "Plugin tidak tersedia", "error");
        writeLog("SecureStorage constructor tidak tersedia.");
        return;
    }

    appState.secureStorage = new SecureStorage(
        function () {
            setPanelStatus("status-secure-storage", "Storage siap", "ok");
            writeLog("SecureStorage berhasil diinisialisasi.");
        },
        function (error) {
            setPanelStatus("status-secure-storage", "Init gagal", "error");
            writeLog("SecureStorage init error: " + formatError(error));
        },
        "ctech_mobile_store"
    );
}

function secureSetSample() {
    if (!appState.secureStorage) {
        setPanelStatus("status-secure-storage", "Storage belum siap", "warn");
        writeLog("SecureStorage belum siap.");
        return;
    }

    appState.secureStorage.set(
        function (key) {
            setPanelStatus("status-secure-storage", "Data tersimpan", "ok");
            writeLog("SecureStorage set berhasil untuk key: " + key);
        },
        function (error) {
            setPanelStatus("status-secure-storage", "Simpan gagal", "error");
            writeLog("SecureStorage set error: " + formatError(error));
        },
        "sample_token",
        "ctech-demo-value"
    );
}

function secureGetSample() {
    if (!appState.secureStorage) {
        setPanelStatus("status-secure-storage", "Storage belum siap", "warn");
        writeLog("SecureStorage belum siap.");
        return;
    }

    appState.secureStorage.get(
        function (value) {
            setPanelStatus("status-secure-storage", "Data dibaca", "ok");
            writeLog("SecureStorage value: " + value);
        },
        function (error) {
            setPanelStatus("status-secure-storage", "Baca gagal", "error");
            writeLog("SecureStorage get error: " + formatError(error));
        },
        "sample_token"
    );
}

function secureRemoveSample() {
    if (!appState.secureStorage) {
        setPanelStatus("status-secure-storage", "Storage belum siap", "warn");
        writeLog("SecureStorage belum siap.");
        return;
    }

    appState.secureStorage.remove(
        function (key) {
            setPanelStatus("status-secure-storage", "Data dihapus", "ok");
            writeLog("SecureStorage remove berhasil untuk key: " + key);
        },
        function (error) {
            setPanelStatus("status-secure-storage", "Hapus gagal", "error");
            writeLog("SecureStorage remove error: " + formatError(error));
        },
        "sample_token"
    );
}

function initBackgroundModeEvents() {
    var mode = getBackgroundMode();

    if (!mode || !mode.on) {
        return;
    }

    mode.on("activate", function () {
        writeLog("Background mode event: activate");
    });

    mode.on("deactivate", function () {
        writeLog("Background mode event: deactivate");
    });
}

function initLocalNotificationListeners() {
    var local = getLocalNotification();
    var firebase = getFirebasePlugin();

    if (firebase && firebase.onTokenRefresh) {
        firebase.onTokenRefresh(
            function (token) {
                writeLog("Firebase token refresh: " + token);
                console.log("Token FCM baru: " + token);
            },
            function (error) {
                writeLog("Firebase onTokenRefresh error: " + formatError(error));
            }
        );
    }

    if (!local || !local.on) {
        return;
    }

    local.on("click", function (notification) {
        writeLog("Local notification click: " + stringify(notification));
    });

    local.on("trigger", function (notification) {
        writeLog("Local notification trigger: " + stringify(notification));
    });
}

function messageHasVisibleContent(message) {
    var payload = message && message.additionalData ? message.additionalData : {};

    return !!(
        (message && message.title) ||
        (message && message.body) ||
        (message && message.message) ||
        payload.title ||
        payload.body ||
        payload.message
    );
}

function getFirebasePlugin() {
    return window.FirebasePlugin || null;
}

function getDiagnostic() {
    if (!window.cordova || !cordova.plugins || !cordova.plugins.diagnostic) {
        return null;
    }

    return cordova.plugins.diagnostic;
}

function getLocalNotification() {
    if (!window.cordova || !cordova.plugins || !cordova.plugins.notification) {
        return null;
    }

    return cordova.plugins.notification.local;
}

function getBackgroundMode() {
    if (!window.cordova || !cordova.plugins) {
        return null;
    }

    return cordova.plugins.backgroundMode;
}

function renderList(id, items) {
    var element = document.getElementById(id);

    if (!element) {
        return;
    }

    element.innerHTML = items.map(function (item) {
        return "<li>" + escapeHtml(item) + "</li>";
    }).join("");
}

function setPanelStatus(id, text, tone) {
    var element = document.getElementById(id);

    if (!element) {
        return;
    }

    element.textContent = text;
    element.className = "panel__status" + toneClassSuffix(tone);
}

function setBadge(id, text, tone) {
    var element = document.getElementById(id);

    if (!element) {
        return;
    }

    element.textContent = text;
    element.className = id === "platform-badge" ? "badge badge--soft" : "badge";

    if (tone === "ok") {
        element.className += " badge--ok";
    } else if (tone === "warn") {
        element.className += " badge--warn";
    } else if (tone === "error") {
        element.className += " badge--error";
    }
}

function toneClassSuffix(tone) {
    if (tone === "ok") {
        return " panel__status--ok";
    }

    if (tone === "warn") {
        return " panel__status--warn";
    }

    if (tone === "error") {
        return " panel__status--error";
    }

    return "";
}

function clearLog() {
    var logElement = document.getElementById("app-log");

    if (logElement) {
        logElement.textContent = "Log dibersihkan.";
    }
}

function writeLog(message) {
    var logElement = document.getElementById("app-log");
    var line = "[" + timestamp() + "] " + message;

    if (!logElement) {
        return;
    }

    logElement.textContent = logElement.textContent === "Menunggu deviceready..."
        ? line
        : logElement.textContent + "\n" + line;

    logElement.scrollTop = logElement.scrollHeight;
}

function getPlatformName() {
    return window.cordova ? cordova.platformId : "web";
}

function stringify(value) {
    try {
        return JSON.stringify(value, null, 2);
    } catch (error) {
        return String(value);
    }
}

function formatError(error) {
    if (typeof error === "string") {
        return error;
    }

    return stringify(error);
}

function timestamp() {
    var now = new Date();

    return now.toLocaleTimeString("id-ID", {
        hour12: false
    });
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
