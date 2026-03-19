# GitHub Release Setup

Workflow release Android yang signed ada di:

- `.github/workflows/android-release.yml`

Sebelum workflow itu bisa jalan, Anda perlu menambahkan GitHub Secrets berikut di repo:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `ANDROID_KEYSTORE_TYPE`

Nilai yang harus diisi:

- `ANDROID_KEYSTORE_BASE64`
  Isi dengan hasil encode base64 dari file keystore Anda.
- `ANDROID_KEYSTORE_PASSWORD`
  Password keystore.
- `ANDROID_KEY_ALIAS`
  Alias key Android.
- `ANDROID_KEY_PASSWORD`
  Password alias key.
- `ANDROID_KEYSTORE_TYPE`
  Biasanya `jks` atau `pkcs12`.

Contoh membuat base64 dari keystore di Linux:

```bash
base64 -w 0 my-release-key.jks > keystore.base64.txt
```

Lalu copy isi file `keystore.base64.txt` ke secret `ANDROID_KEYSTORE_BASE64`.

Langkah pakai di GitHub:

1. Buka repo GitHub Anda.
2. Masuk ke `Settings`.
3. Buka `Secrets and variables` > `Actions`.
4. Tambahkan semua secret di atas.
5. Buka tab `Actions`.
6. Jalankan workflow `Build Signed Android Release`.
7. Setelah selesai, download artifact `ctech-mobile-android-release`.

Catatan:

- Workflow ini membangun APK release signed.
- Jika nanti Anda ingin build `AAB` untuk Play Store, workflow ini bisa diubah lagi.
- File `google-services.json` tetap harus ada di repo atau diinject sebagai secret terpisah jika suatu saat Anda memilih tidak menyimpannya di repo.
