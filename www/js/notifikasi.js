var ID_CHANNEL_FIREBASE = "ctech_alerts_v1";
var NAMA_SOUND_NOTIF_ANDROID = "notif";
var RESOURCE_SOUND_NOTIF_LOKAL = "res://notif.mp3";
var RESOURCE_ICON_NOTIF_KECIL = "res://drawable/notification_icon";
var RESOURCE_ICON_NOTIF_BESAR = "res://drawable/notification_icon_large";
var URL_DAFTAR_TOKEN_FCM = "https://server.mitraexplore.com/fcm";
var ID_SALESMAN_TOKEN_FCM = 1;
var KUNCI_IDCORDOVA_PERANGKAT = "ctech_idcordova_perangkat";

function siapkanNotifikasiFirebase() {
    var firebase = ambilPluginFirebase();
    var notifikasiLokal = ambilNotifikasiLokal();

    if (!firebase) {
        tulisKeKonsol("Firebase plugin belum tersedia. Setup notifikasi dilewati.");
        return;
    }

    if (firebase.hasPermission) {
        firebase.hasPermission(
            function (diizinkan) {
                tulisKeKonsol("Izin notifikasi Firebase aktif: " + diizinkan);

                if (!diizinkan && firebase.grantPermission) {
                    firebase.grantPermission(
                        function () {
                            tulisKeKonsol("Permintaan izin notifikasi Firebase berhasil dikirim.");
                        },
                        function (galat) {
                            tulisKeKonsol("Gagal meminta izin Firebase: " + formatGalat(galat));
                        }
                    );
                }
            },
            function (galat) {
                tulisKeKonsol("Gagal mengecek izin Firebase: " + formatGalat(galat));
            }
        );
    }

    if (firebase.createChannel) {
        firebase.createChannel(
            {
                id: ID_CHANNEL_FIREBASE,
                name: "ctech Mobile Notifications",
                description: "Notifikasi default dari ctech mobile",
                importance: 4,
                sound: NAMA_SOUND_NOTIF_ANDROID,
                lights: true,
                vibration: true,
                smallIcon: "notification_icon"
            },
            function () {
                tulisKeKonsol("Channel Firebase siap dengan logo aplikasi dan sound notif.");

                if (firebase.setDefaultChannel) {
                    firebase.setDefaultChannel(
                        { id: ID_CHANNEL_FIREBASE },
                        function () {
                            tulisKeKonsol("Default channel Firebase berhasil diatur.");
                        },
                        function (galat) {
                            tulisKeKonsol("Gagal mengatur default channel Firebase: " + formatGalat(galat));
                        }
                    );
                }
            },
            function (galat) {
                tulisKeKonsol("Gagal membuat channel Firebase: " + formatGalat(galat));
            }
        );
    }

    if (firebase.onMessageReceived) {
        firebase.onMessageReceived(
            function (pesan) {
                var pesanForeground = !pesan || !pesan.tap;

                tulisKeKonsol("Pesan Firebase diterima: " + ubahKeString(pesan));

                if (pesanForeground && notifikasiLokal && pesanPunyaIsi(pesan)) {
                    tampilkanNotifikasiLokalDariFirebase(pesan);
                } else if (!pesanForeground) {
                    tulisKeKonsol("Notifikasi dibuka dari tray sistem.");
                }
            },
            function (galat) {
                tulisKeKonsol("Listener Firebase gagal: " + formatGalat(galat));
            }
        );
    }

    tulisKeKonsol("Saat aplikasi background atau tertutup, payload FCM native harus memakai channel_id yang sama dengan aplikasi dan sound notif agar Android tidak jatuh ke suara default OS.");
}

function tampilkanNotifikasiLokalDariFirebase(pesanFirebase) {
    var notifikasiLokal = ambilNotifikasiLokal();
    var payloadTambahan = pesanFirebase.additionalData || {};
    var judul = pesanFirebase.title || payloadTambahan.title || "ctech-mobile";
    var isi = (
        pesanFirebase.body ||
        pesanFirebase.message ||
        payloadTambahan.body ||
        payloadTambahan.message ||
        "Notifikasi baru"
    );
    // Menyesuaikan dengan struktur payload android.notification.imageUrl
    var gambar = (
        pesanFirebase.image ||
        (pesanFirebase.android && pesanFirebase.android.notification ? pesanFirebase.android.notification.imageUrl : "") ||
        (pesanFirebase.android ? pesanFirebase.android.image : "") ||
        payloadTambahan.image ||
        payloadTambahan.picture ||
        ""
    );

    if (!notifikasiLokal || !notifikasiLokal.schedule) {
        tulisKeKonsol("Notifikasi lokal tidak tersedia untuk menampilkan pesan Firebase.");
        return;
    }

    // Mengambil channelId secara dinamis jika ada di payload, jika tidak gunakan default
    var channelId = (pesanFirebase.android && pesanFirebase.android.notification) 
                    ? pesanFirebase.android.notification.channelId 
                    : ID_CHANNEL_FIREBASE;

    notifikasiLokal.schedule(bangunOpsiNotifikasiAndroid(judul, isi, payloadTambahan, gambar, channelId));

    tulisKeKonsol("Pesan Firebase foreground diubah menjadi notifikasi lokal dengan icon dan sound channel yang sama.");
}

function bangunOpsiNotifikasiAndroid(judul, isi, dataTambahan, gambar, channelId) {
    var opsi = {
        id: Date.now(),
        title: judul,
        text: isi,
        trigger: { at: new Date(Date.now() + 250) },
        sound: RESOURCE_SOUND_NOTIF_LOKAL,
        smallIcon: RESOURCE_ICON_NOTIF_KECIL,
        icon: RESOURCE_ICON_NOTIF_BESAR,
        androidChannelId: channelId || ID_CHANNEL_FIREBASE,
        data: dataTambahan || {}
    };

    if (gambar) {
        opsi.attachments = [gambar];
    }

    return opsi;
}

function ambilDanTulisTokenFirebase() {
    var firebase = ambilPluginFirebase();

    if (!firebase || !firebase.getToken) {
        tulisKeKonsol("Token Firebase tidak bisa diambil karena plugin belum tersedia.");
        return;
    }

    firebase.getToken(
        function (token) {
            if (!token) {
                tulisKeKonsol("Token Firebase kosong.");
                return;
            }

            tulisKeKonsol("Token Firebase perangkat: " + token);
            sinkronkanTokenFirebaseKeServer(token, "token awal");
        },
        function (galat) {
            tulisKeKonsol("Gagal mengambil token Firebase: " + formatGalat(galat));
        }
    );
}

function siapkanListenerNotifikasiLokal() {
    var notifikasiLokal = ambilNotifikasiLokal();
    var firebase = ambilPluginFirebase();

    if (firebase && firebase.onTokenRefresh) {
        firebase.onTokenRefresh(
            function (token) {
                if (!token) {
                    tulisKeKonsol("Firebase token refresh kosong.");
                    return;
                }

                tulisKeKonsol("Firebase token refresh: " + token);
                sinkronkanTokenFirebaseKeServer(token, "token refresh");
            },
            function (galat) {
                tulisKeKonsol("Gagal menerima token refresh Firebase: " + formatGalat(galat));
            }
        );
    }

    if (!notifikasiLokal || !notifikasiLokal.on) {
        return;
    }

    notifikasiLokal.on("click", function (notifikasi) {
        tulisKeKonsol("Notifikasi lokal diklik: " + ubahKeString(notifikasi));
    });

    notifikasiLokal.on("trigger", function (notifikasi) {
        tulisKeKonsol("Notifikasi lokal terpicu: " + ubahKeString(notifikasi));
    });
}

function sinkronkanTokenFirebaseKeServer(token, sumberToken) {
    var idCordova;
    var payload;

    if (!token) {
        tulisKeKonsol("Sinkron token Firebase dilewati karena token kosong.");
        return;
    }

    if (typeof fetch !== "function") {
        tulisKeKonsol("Fetch tidak tersedia. Sinkron token Firebase ke server dilewati.");
        return;
    }

    idCordova = ambilIdCordovaPerangkat();
    payload = {
        data: {
            idcordova: idCordova,
            token: token,
            id_salesman: ID_SALESMAN_TOKEN_FCM
        }
    };

    tulisKeKonsol(
        "Mengirim token Firebase ke server /fcm untuk id_salesman " +
            ID_SALESMAN_TOKEN_FCM +
            " dari " +
            sumberToken +
            "."
    );

    fetch(URL_DAFTAR_TOKEN_FCM, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    })
        .then(function (response) {
            return response.text().then(function (isi) {
                var dataRespons = parseJsonAman(isi);
                var pesanRespons = dataRespons && dataRespons.message ? dataRespons.message : isi;

                if (!response.ok) {
                    throw new Error(
                        "HTTP " + response.status + " " + response.statusText + ": " + (pesanRespons || "Gagal sinkron token Firebase.")
                    );
                }

                tulisKeKonsol("Token Firebase berhasil disinkronkan ke server: " + ubahKeString(dataRespons || isi));
            });
        })
        .catch(function (galat) {
            tulisKeKonsol("Gagal mengirim token Firebase ke server: " + formatGalat(galat));
        });
}

function ambilIdCordovaPerangkat() {
    var idTersimpan;
    var idPerangkat = window.device && device.uuid ? device.uuid : "";

    if (idPerangkat) {
        simpanIdCordovaPerangkat(idPerangkat);
        return idPerangkat;
    }

    idTersimpan = ambilIdCordovaTersimpan();
    if (idTersimpan) {
        return idTersimpan;
    }

    idPerangkat = "ctech-" + namaPlatform() + "-" + Date.now();
    simpanIdCordovaPerangkat(idPerangkat);
    return idPerangkat;
}

function ambilIdCordovaTersimpan() {
    try {
        return window.localStorage ? localStorage.getItem(KUNCI_IDCORDOVA_PERANGKAT) : "";
    } catch (galat) {
        tulisKeKonsol("Gagal membaca idcordova tersimpan: " + formatGalat(galat));
        return "";
    }
}

function simpanIdCordovaPerangkat(idCordova) {
    try {
        if (window.localStorage && idCordova) {
            localStorage.setItem(KUNCI_IDCORDOVA_PERANGKAT, idCordova);
        }
    } catch (galat) {
        tulisKeKonsol("Gagal menyimpan idcordova perangkat: " + formatGalat(galat));
    }
}

function parseJsonAman(teks) {
    if (!teks) {
        return null;
    }

    try {
        return JSON.parse(teks);
    } catch (galat) {
        return null;
    }
}

function ambilPluginFirebase() {
    return window.FirebasePlugin || null;
}

function ambilNotifikasiLokal() {
    if (!window.cordova || !cordova.plugins || !cordova.plugins.notification) {
        return null;
    }

    return cordova.plugins.notification.local;
}

function pesanPunyaIsi(pesan) {
    var dataTambahan = pesan && pesan.additionalData ? pesan.additionalData : {};

    return !!(
        (pesan && pesan.title) ||
        (pesan && pesan.body) ||
        (pesan && pesan.message) ||
        dataTambahan.title ||
        dataTambahan.body ||
        dataTambahan.message
    );
}
