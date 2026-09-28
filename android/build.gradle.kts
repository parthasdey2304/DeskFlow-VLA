plugins { id("com.android.application") version "8.5.2"; id("org.jetbrains.kotlin.android") version "2.0.20" }
android {
    namespace = "com.deskflow.app"
    compileSdk = 34
    defaultConfig {
        applicationId = "com.deskflow.app"
        minSdk = 29; targetSdk = 34; versionCode = 1; versionName = "1.0.0-production"
        ndk { abiFilters += "arm64-v8a" }
    }
    buildTypes { release { isMinifyEnabled = true } }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-compose:1.9.2")
    implementation(platform("androidx.compose:compose-bom:2024.09.00"))
    implementation("androidx.compose.material3:material3")
    implementation("com.google.firebase:firebase-firestore-ktx:25.1.0")
}
