var statusAplikasi = {
    siap: false,
    penyimpananAman: null,
    sedangMemeriksaUpdate: false
};

document.addEventListener("DOMContentLoaded", saatDomSiap, false);
document.addEventListener("deviceready", saatPerangkatSiap, false);
document.addEventListener("resume", saatAplikasiKembaliAktif, false);

function saatDomSiap() {
    tulisKeKonsol("DOM siap. Menunggu deviceready dari Cordova.");
}

function saatPerangkatSiap() {
    statusAplikasi.siap = true;

    tulisInfoPerangkat();
    terapkanLayarPenuhSaatMulai();
    siapkanNotifikasiFirebase();
    siapkanListenerModeLatar();
    siapkanListenerNotifikasiLokal();
    siapkanPenyimpananAman();
    ambilDanTulisTokenFirebase();
    muatManifestLokal()
        .finally(function () {
            periksaUpdateAplikasi();
        });

    tulisKeKonsol("Device ready aktif. Inisialisasi aplikasi selesai.");
}

function saatAplikasiKembaliAktif() {
    tulisKeKonsol("Aplikasi kembali aktif. Memeriksa update terbaru.");
    cobaLanjutkanInstallApkTertunda();
    periksaUpdateAplikasi();
}

function terapkanLayarPenuhSaatMulai() {
    document.addEventListener('deviceready', function () {

        if (window.StatusBar) {

            if (typeof StatusBar.overlaysWebView === "function") {
                StatusBar.overlaysWebView(true); // overlay ke status bar
            }

            if (typeof StatusBar.backgroundColorByHexString === "function") {
                StatusBar.backgroundColorByHexString("#00000000"); // transparan (WAJIB pakai hex)
            }

            if (typeof StatusBar.styleLightContent === "function") {
                StatusBar.styleLightContent(); // icon putih
            }

            if (typeof StatusBar.show === "function") {
                StatusBar.show(); // status bar tetap tampil
            }
        }

        // Tambah listener scroll untuk header effect
        siapkanScrollHeaderEffect();
    });

}

function siapkanScrollHeaderEffect() {
    const header = document.querySelector(".header");

    if (!header) {
        return;
    }

    window.addEventListener("scroll", function () {
        if (window.scrollY > 10) {
            header.classList.add("scrolled");
        } else {
            header.classList.remove("scrolled");
        }
    });

    tulisKeKonsol("Scroll header effect siap.");
}

function tulisInfoPerangkat() {
    var informasi = {
        statusCordova: window.cordova ? "aktif" : "tidak aktif",
        platform: namaPlatform(),
        versiCordova: window.cordova ? cordova.version : "tidak tersedia",
        modelPerangkat: window.device ? device.model : "plugin-device belum tersedia"
    };

    tulisKeKonsol("Info perangkat: " + ubahKeString(informasi));
}

function siapkanPenyimpananAman() {
    if (!window.SecureStorage) {
        tulisKeKonsol("SecureStorage tidak tersedia.");
        return;
    }

    statusAplikasi.penyimpananAman = new SecureStorage(
        function () {
            tulisKeKonsol("SecureStorage berhasil diinisialisasi.");
        },
        function (galat) {
            tulisKeKonsol("SecureStorage gagal diinisialisasi: " + formatGalat(galat));
        },
        "ctech_mobile_store"
    );
}

function siapkanListenerModeLatar() {
    var modeLatar = ambilModeLatar();

    if (!modeLatar || !modeLatar.on) {
        return;
    }

    modeLatar.on("activate", function () {
        tulisKeKonsol("Background mode aktif.");
    });

    modeLatar.on("deactivate", function () {
        tulisKeKonsol("Background mode nonaktif.");
    });
}

function cekStatusLokasiDiagnostik() {
    var diagnostik = ambilDiagnostik();

    if (!diagnostik || !diagnostik.location || !diagnostik.location.isLocationEnabled) {
        tulisKeKonsol("Plugin diagnostic lokasi tidak tersedia.");
        return;
    }

    diagnostik.location.isLocationEnabled(
        function (aktif) {
            tulisKeKonsol("Status lokasi perangkat: " + aktif);
        },
        function (galat) {
            tulisKeKonsol("Gagal mengecek lokasi: " + formatGalat(galat));
        }
    );
}

function cekStatusNotifikasiDiagnostik() {
    var diagnostik = ambilDiagnostik();

    if (!diagnostik || !diagnostik.notifications || !diagnostik.notifications.isRemoteNotificationsEnabled) {
        tulisKeKonsol("Plugin diagnostic notifikasi tidak tersedia.");
        return;
    }

    diagnostik.notifications.isRemoteNotificationsEnabled(
        function (aktif) {
            tulisKeKonsol("Status notifikasi remote: " + aktif);
        },
        function (galat) {
            tulisKeKonsol("Gagal mengecek notifikasi remote: " + formatGalat(galat));
        }
    );
}

function ambilDiagnostik() {
    if (!window.cordova || !cordova.plugins || !cordova.plugins.diagnostic) {
        return null;
    }

    return cordova.plugins.diagnostic;
}

function ambilModeLatar() {
    if (!window.cordova || !cordova.plugins) {
        return null;
    }

    return cordova.plugins.backgroundMode;
}

function namaPlatform() {
    return window.cordova ? cordova.platformId : "web";
}

function ubahKeString(nilai) {
    try {
        return JSON.stringify(nilai, null, 2);
    } catch (galat) {
        return String(nilai);
    }
}

function formatGalat(galat) {
    if (typeof galat === "string") {
        return galat;
    }

    return ubahKeString(galat);
}

function tulisKeKonsol(pesan) {
    console.log("[ctech-mobile]", pesan);
    tampilkanStatusUpdateDiHalaman(pesan);
}

function tampilkanStatusUpdateDiHalaman(pesan) {
    var elemenRingkas = document.getElementById("status-update-ringkas");
    var elemenLog = document.getElementById("status-update-log");
    var waktu = new Date().toLocaleTimeString("id-ID", { hour12: false });
    var barisLog = "[" + waktu + "] " + pesan;

    if (elemenRingkas) {
        elemenRingkas.textContent = pesan;
    }

    if (elemenLog) {
        if (elemenLog.textContent === "Log update akan tampil di sini.") {
            elemenLog.textContent = barisLog;
        } else {
            elemenLog.textContent += "\n" + barisLog;
        }

        elemenLog.scrollTop = elemenLog.scrollHeight;
    }
}
