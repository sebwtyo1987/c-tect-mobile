if (typeof statusAplikasi === "undefined") {
    var statusAplikasi = {};
}

statusAplikasi.cekUpdateDihentikan = false;
statusAplikasi.sedangMengunduhPembaruan = false;
statusAplikasi.manifestBuild = null;
statusAplikasi.infoApkUpdateTertunda = null;
statusAplikasi.sedangMenungguIzinInstallApk = false;

var VERSI_APLIKASI = "1.0.2";
var URL_DASAR_UPDATE = "https://server.mitraexplore.com/ctech";
var URL_MANIFEST_LOKAL = "version.json";
var URL_MANIFEST_UPDATE = URL_DASAR_UPDATE + "/version.json";
var KUNCI_MANIFEST_UPDATE = "ctech_manifest_update";
var NAMA_FILE_APK_UPDATE = "ctech-mobile-update.apk";

function periksaUpdateAplikasi() {
    if (statusAplikasi.cekUpdateDihentikan) {
        tulisKeKonsol("Aplikasi terbaru. Pengecekan update dihentikan.");
        return;
    }

    if (statusAplikasi.sedangMemeriksaUpdate) {
        return;
    }

    statusAplikasi.sedangMemeriksaUpdate = true;
    tulisKeKonsol("Memeriksa update aplikasi ke " + URL_MANIFEST_UPDATE);

    unduhManifestServer()
        .then(function (manifestUpdate) {
            tanganiManifestUpdate(ambilManifestAcuan(), manifestUpdate);
        })
        .catch(function (galat) {
            tulisKeKonsol("Gagal memeriksa update aplikasi: " + formatGalat(galat));
        })
        .finally(function () {
            statusAplikasi.sedangMemeriksaUpdate = false;
        });
}

function tanganiManifestUpdate(manifestLokal, manifestServer) {
    var versiLokalManifest = ambilVersiManifest(manifestLokal);
    var perbandinganAplikasi;
    var urlUnduh = manifestServer.url || manifestServer.apk_url || manifestServer.download_url || "";
    var catatan = manifestServer.notes || manifestServer.catatan || "Versi baru tersedia.";
    var paksaUpdate = !!(manifestServer.force || manifestServer.paksa);
    var versiServer = ambilVersiManifest(manifestServer);

    if (!versiServer) {
        tulisKeKonsol("Manifest server tidak memiliki field version/versi.");
        return;
    }

    tulisKeKonsol("Versi aplikasi: " + VERSI_APLIKASI + ", versi manifest lokal: " + (versiLokalManifest || "tidak ada") + ", versi server: " + versiServer);
    perbandinganAplikasi = bandingkanVersi(versiServer, VERSI_APLIKASI);

    if (versiLokalManifest && bandingkanVersi(versiLokalManifest, VERSI_APLIKASI) > 0) {
        tulisKeKonsol("Manifest lokal lebih baru dari versi aplikasi terpasang. Penentuan update tetap memakai versi aplikasi.");
    }

    if (perbandinganAplikasi === 0) {
        hentikanCekUpdate("Aplikasi terbaru.");
        return;
    }

    if (perbandinganAplikasi < 0) {
        hentikanCekUpdate("Aplikasi terbaru. Versi server lebih lama dari aplikasi terpasang.");
        return;
    }

    if (!urlUnduh) {
        tulisKeKonsol("Update tersedia, tetapi URL unduh tidak ditemukan di manifest.");
        return;
    }

    simpanManifestUpdate(manifestServer);
    tampilkanPromptUpdate(versiServer, urlUnduh, catatan, paksaUpdate);
}

function muatManifestLokal() {
    tulisKeKonsol("Membaca version.json bawaan aplikasi dari " + URL_MANIFEST_LOKAL);

    return fetch(URL_MANIFEST_LOKAL + "?_=" + Date.now(), {
        method: "GET",
        cache: "no-store"
    })
        .then(function (respon) {
            if (!respon.ok) {
                throw new Error("HTTP " + respon.status);
            }

            return respon.json();
        })
        .then(function (manifestLokal) {
            simpanManifestBuild(manifestLokal);
            tulisKeKonsol("version.json bawaan berhasil dibaca.");
            return manifestLokal;
        })
        .catch(function (galat) {
            tulisKeKonsol("Gagal membaca version.json bawaan: " + formatGalat(galat));
            return null;
        });
}

function unduhManifestServer() {
    tulisKeKonsol("Mengunduh version.json server.");

    return fetch(URL_MANIFEST_UPDATE + "?_=" + Date.now(), {
        method: "GET",
        cache: "no-store"
    })
        .then(function (respon) {
            if (!respon.ok) {
                throw new Error("HTTP " + respon.status);
            }

            return respon.json();
        });
}

function simpanManifestBuild(manifestLokal) {
    statusAplikasi.manifestBuild = normalisasiManifest(manifestLokal);
}

function ambilManifestAcuan() {
    var manifestBuild = statusAplikasi.manifestBuild || null;
    var manifestTersimpan = ambilManifestUpdateTersimpan();
    var versiBuild = ambilVersiManifest(manifestBuild);
    var versiTersimpan = ambilVersiManifest(manifestTersimpan);

    if (versiBuild && versiTersimpan) {
        return bandingkanVersi(versiTersimpan, versiBuild) > 0 ? manifestTersimpan : manifestBuild;
    }

    if (versiTersimpan) {
        return manifestTersimpan;
    }

    if (versiBuild) {
        return manifestBuild;
    }

    return normalisasiManifest({
        version: VERSI_APLIKASI
    });
}

function tampilkanPromptUpdate(versiBaru, urlUnduh, catatan, paksaUpdate) {
    var judul = "Update tersedia";
    var pesan = "Versi baru " + versiBaru + " tersedia.\n\n" + catatan;

    tulisKeKonsol("Update ditemukan. URL unduh: " + urlUnduh);

    if (navigator.notification && navigator.notification.confirm) {
        navigator.notification.confirm(
            pesan,
            function (indeksTombol) {
                if (indeksTombol === 1) {
                    unduhDanPasangPembaruan(urlUnduh, versiBaru);
                    return;
                }

                if (paksaUpdate) {
                    tulisKeKonsol("Update wajib. Mengunduh pembaruan aplikasi.");
                    unduhDanPasangPembaruan(urlUnduh, versiBaru);
                } else {
                    tulisKeKonsol("Pengguna menunda update aplikasi.");
                }
            },
            judul,
            paksaUpdate ? ["Update sekarang"] : ["Update sekarang", "Nanti"]
        );
        return;
    }

    if (paksaUpdate || window.confirm(pesan)) {
        unduhDanPasangPembaruan(urlUnduh, versiBaru);
    }
}

function bukaLinkUpdate(urlUnduh) {
    tulisKeKonsol("Membuka link update: " + urlUnduh);
    window.open(urlUnduh, "_system");
}

function unduhDanPasangPembaruan(urlUnduh, versiBaru) {
    if (statusAplikasi.sedangMengunduhPembaruan) {
        tulisKeKonsol("Unduhan pembaruan sedang berjalan.");
        return;
    }

    if (!window.cordova || !window.resolveLocalFileSystemURL || !window.FileReader) {
        tampilkanGalatPembaruan("Plugin file belum tersedia. Update tidak dapat dijalankan dari dalam aplikasi.");
        return;
    }

    if (!cordova.file) {
        tampilkanGalatPembaruan("cordova.file tidak tersedia. Update tidak dapat dijalankan dari dalam aplikasi.");
        return;
    }

    statusAplikasi.sedangMengunduhPembaruan = true;
    tulisKeKonsol("Mengunduh APK pembaruan versi " + versiBaru + " dari " + urlUnduh);

    unduhFileSebagaiBlob(urlUnduh)
        .then(function (blobApk) {
            tulisKeKonsol("APK pembaruan berhasil diunduh. Menyimpan file sementara.");
            return simpanBlobKeFileApk(blobApk, NAMA_FILE_APK_UPDATE);
        })
        .then(function (infoFile) {
            tulisKeKonsol("File APK tersimpan di " + infoFile.nativeURL);
            statusAplikasi.infoApkUpdateTertunda = infoFile;
            return bukaInstallerApk(infoFile);
        })
        .then(function () {
            statusAplikasi.sedangMenungguIzinInstallApk = false;
            statusAplikasi.infoApkUpdateTertunda = null;
            tulisKeKonsol("Installer APK berhasil dibuka dari dalam aplikasi.");
        })
        .catch(function (galat) {
            tulisKeKonsol("Gagal mengunduh atau memasang pembaruan: " + formatGalat(galat));

            if (apakahPerluIzinInstallApk(galat)) {
                arahkanKePengaturanIzinInstallApk(galat);
                return;
            }

            tampilkanGalatPembaruan("Gagal memasang pembaruan dari dalam aplikasi. " + formatGalat(galat));
        })
        .finally(function () {
            statusAplikasi.sedangMengunduhPembaruan = false;
        });
}

function unduhFileSebagaiBlob(urlUnduh) {
    return fetch(urlUnduh + (urlUnduh.indexOf("?") >= 0 ? "&" : "?") + "_=" + Date.now(), {
        method: "GET",
        cache: "no-store"
    })
        .then(function (respon) {
            if (!respon.ok) {
                throw new Error("HTTP " + respon.status);
            }

            return respon.blob();
        });
}

function simpanBlobKeFileApk(blobApk, namaFile) {
    return new Promise(function (resolve, reject) {
        var direktoriTarget = ambilDirektoriApkSementara();

        if (!direktoriTarget) {
            reject(new Error("Direktori penyimpanan APK sementara tidak tersedia"));
            return;
        }

        window.resolveLocalFileSystemURL(
            direktoriTarget,
            function (dirEntry) {
                dirEntry.getFile(
                    namaFile,
                    { create: true, exclusive: false },
                    function (fileEntry) {
                        fileEntry.createWriter(
                            function (fileWriter) {
                                fileWriter.onwriteend = function () {
                                    resolve(fileEntry);
                                };

                                fileWriter.onerror = function (galat) {
                                    reject(galat);
                                };

                                fileWriter.write(blobApk);
                            },
                            reject
                        );
                    },
                    reject
                );
            },
            reject
        );
    });
}

function bukaInstallerApk(fileEntry) {
    return new Promise(function (resolve, reject) {
        var fileOpener = ambilFileOpener();
        var kandidatPath = ambilKandidatPathFile(fileEntry);

        if (!fileOpener || !fileOpener.open) {
            reject(new Error("cordova-plugin-file-opener2 belum tersedia"));
            return;
        }

        if (!kandidatPath.length) {
            reject(new Error("Tidak ada path file APK yang bisa dibuka oleh installer"));
            return;
        }

        cobaBukaInstallerDenganKandidat(fileOpener, kandidatPath, 0, resolve, reject);
    });
}

function apakahPerluIzinInstallApk(galat) {
    var pesanGalat = String(formatGalat(galat) || "").toLowerCase();

    if (namaPlatform() !== "android") {
        return false;
    }

    return (
        pesanGalat.indexOf("permission") >= 0 ||
        pesanGalat.indexOf("install") >= 0 ||
        pesanGalat.indexOf("unknown") >= 0 ||
        pesanGalat.indexOf("sumber tidak dikenal") >= 0 ||
        pesanGalat.indexOf("activity not started") >= 0 ||
        pesanGalat.indexOf("failed to find configured root") >= 0 ||
        pesanGalat.indexOf("apk") >= 0
    );
}

function arahkanKePengaturanIzinInstallApk(galat) {
    var diagnostik = ambilDiagnostik();
    var pesan = "Android menolak membuka installer APK. Izinkan dulu menu Install unknown apps / Sumber tidak dikenal untuk aplikasi ini, lalu kembali ke aplikasi. Installer akan dicoba lagi secara otomatis.\n\nDetail: " + formatGalat(galat);

    statusAplikasi.sedangMenungguIzinInstallApk = true;

    tampilkanInfoIzinInstallApk(pesan, function () {
        if (diagnostik && diagnostik.switchToSettings) {
            diagnostik.switchToSettings(
                function () {
                    tulisKeKonsol("Pengaturan aplikasi dibuka untuk mengaktifkan izin install APK.");
                },
                function (galatPengaturan) {
                    tulisKeKonsol("Gagal membuka pengaturan aplikasi: " + formatGalat(galatPengaturan));
                }
            );
            return;
        }

        tulisKeKonsol("Plugin diagnostic tidak tersedia. Buka pengaturan aplikasi secara manual untuk mengaktifkan izin install APK.");
    });
}

function tampilkanInfoIzinInstallApk(pesan, setelahTutup) {
    if (navigator.notification && navigator.notification.alert) {
        navigator.notification.alert(pesan, setelahTutup || null, "Izin Install Diperlukan", "Buka Pengaturan");
        return;
    }

    window.alert(pesan);

    if (setelahTutup) {
        setelahTutup();
    }
}

function cobaLanjutkanInstallApkTertunda() {
    if (!statusAplikasi.sedangMenungguIzinInstallApk || !statusAplikasi.infoApkUpdateTertunda) {
        return;
    }

    tulisKeKonsol("Aplikasi kembali aktif. Mencoba membuka lagi installer APK yang tertunda.");

    bukaInstallerApk(statusAplikasi.infoApkUpdateTertunda)
        .then(function () {
            statusAplikasi.sedangMenungguIzinInstallApk = false;
            statusAplikasi.infoApkUpdateTertunda = null;
            tulisKeKonsol("Installer APK berhasil dibuka setelah kembali dari pengaturan.");
        })
        .catch(function (galat) {
            tulisKeKonsol("Installer APK masih belum bisa dibuka: " + formatGalat(galat));
        });
}

function ambilManifestUpdateTersimpan() {
    try {
        var nilai = window.localStorage ? localStorage.getItem(KUNCI_MANIFEST_UPDATE) : "";
        return nilai ? normalisasiManifest(JSON.parse(nilai)) : null;
    } catch (galat) {
        tulisKeKonsol("Gagal membaca manifest update tersimpan: " + formatGalat(galat));
        return null;
    }
}

function simpanManifestUpdate(manifestUpdate) {
    try {
        if (!window.localStorage) {
            return;
        }

        var dataManifest = normalisasiManifest(manifestUpdate);
        dataManifest.disimpanPada = new Date().toISOString();

        localStorage.setItem(KUNCI_MANIFEST_UPDATE, JSON.stringify(dataManifest));
        tulisKeKonsol("Manifest update tersimpan ke local storage.");
    } catch (galat) {
        tulisKeKonsol("Gagal menyimpan manifest update: " + formatGalat(galat));
    }
}

function hentikanCekUpdate(pesan) {
    statusAplikasi.cekUpdateDihentikan = true;
    tulisKeKonsol(pesan || "Aplikasi terbaru. Pengecekan update dihentikan.");
}

function ambilVersiManifest(manifest) {
    if (!manifest) {
        return "";
    }

    return manifest.version || manifest.versi || "";
}

function normalisasiManifest(manifest) {
    if (!manifest) {
        return null;
    }

    return {
        version: manifest.version || manifest.versi || "",
        url: manifest.url || manifest.apk_url || manifest.download_url || "",
        notes: manifest.notes || manifest.catatan || "",
        force: !!(manifest.force || manifest.paksa)
    };
}

function ambilFileOpener() {
    if (!window.cordova || !cordova.plugins) {
        return null;
    }

    return cordova.plugins.fileOpener2 || null;
}

function ambilDirektoriApkSementara() {
    if (!cordova.file) {
        return "";
    }

    return (
        cordova.file.externalDataDirectory ||
        cordova.file.externalCacheDirectory ||
        cordova.file.dataDirectory ||
        cordova.file.cacheDirectory ||
        ""
    );
}

function ambilKandidatPathFile(fileEntry) {
    var kandidat = [];

    if (fileEntry && fileEntry.toInternalURL) {
        kandidat.push(fileEntry.toInternalURL());
    }

    if (fileEntry && fileEntry.nativeURL) {
        kandidat.push(fileEntry.nativeURL);
    }

    if (fileEntry && fileEntry.toURL) {
        kandidat.push(fileEntry.toURL());
    }

    return kandidat.filter(function (nilai, indeks, daftar) {
        return !!nilai && daftar.indexOf(nilai) === indeks;
    });
}

function cobaBukaInstallerDenganKandidat(fileOpener, kandidatPath, indeks, resolve, reject) {
    if (!kandidatPath.length || indeks >= kandidatPath.length) {
        reject(new Error("Tidak ada path file APK yang bisa dibuka oleh installer"));
        return;
    }

    tulisKeKonsol("Mencoba membuka installer APK lewat path: " + kandidatPath[indeks]);

    fileOpener.open(
        kandidatPath[indeks],
        "application/vnd.android.package-archive",
        {
            error: function (galat) {
                tulisKeKonsol("Gagal membuka installer dengan path saat ini: " + formatGalat(galat));
                cobaBukaInstallerDenganKandidat(fileOpener, kandidatPath, indeks + 1, resolve, reject);
            },
            success: resolve
        }
    );
}

function tampilkanGalatPembaruan(pesan) {
    var pesanLengkap = pesan + " Pastikan izin 'Install unknown apps / Sumber tidak dikenal' untuk aplikasi ini sudah diizinkan di Android.";

    tulisKeKonsol(pesanLengkap);

    if (navigator.notification && navigator.notification.alert) {
        navigator.notification.alert(pesanLengkap, null, "Update Gagal", "OK");
        return;
    }

    window.alert(pesanLengkap);
}

function apakahVersiLebihBaru(versiLokal, versiServer) {
    return bandingkanVersi(versiServer, versiLokal) > 0;
}

function bandingkanVersi(versiKiri, versiKanan) {
    var bagianKiri = pecahVersi(versiKiri);
    var bagianKanan = pecahVersi(versiKanan);
    var panjang = Math.max(bagianKiri.length, bagianKanan.length);
    var indeks;

    for (indeks = 0; indeks < panjang; indeks += 1) {
        var nilaiKiri = bagianKiri[indeks] || 0;
        var nilaiKanan = bagianKanan[indeks] || 0;

        if (nilaiKiri > nilaiKanan) {
            return 1;
        }

        if (nilaiKiri < nilaiKanan) {
            return -1;
        }
    }

    return 0;
}

function pecahVersi(versi) {
    return String(versi)
        .split(".")
        .map(function (bagian) {
            var angka = parseInt(bagian, 10);
            return isNaN(angka) ? 0 : angka;
        });
}
