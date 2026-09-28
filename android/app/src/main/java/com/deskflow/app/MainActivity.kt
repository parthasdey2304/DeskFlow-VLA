package com.deskflow.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.dp
import com.deskflow.app.ui.components.HapticSlider
import com.deskflow.app.ui.components.InvoiceCard
import com.deskflow.app.ui.theme.DeskFlowTheme
import com.google.firebase.FirebaseApp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query

data class Invoice(val id: String, val vendor: String, val total: Double, val flagged: Boolean)

/** Local snapshot used when Firestore is unreachable (mirrors the web fallback). */
private fun localLedger() = listOf(
    Invoice("INV-2041", "Acme Corp", 118.00, false),
    Invoice("INV-2042", "Globex", 425.00, true),
)

/** Firestore handle, or null when FirebaseApp can't init (no google-services.json
 *  bundled — add it plus the google-services plugin to upgrade to full sync). */
private fun tryFirestore(): FirebaseFirestore? = try {
    FirebaseApp.getInstance()
    FirebaseFirestore.getInstance()
} catch (_: Exception) {
    null
}

/** Material 3 edge monitor: live feed placeholder, joint jog, Firestore ledger, E-stop. */
@OptIn(ExperimentalMaterial3Api::class)
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // Best-effort init; absence of google-services.json is a normal offline state.
        try { FirebaseApp.initializeApp(this) } catch (_: Exception) { }
        setContent {
            DeskFlowTheme {
                var estopped by remember { mutableStateOf(false) }
                var joints by remember { mutableStateOf(listOf(0.42f, -0.61f, 1.05f, 0.0f)) }
                var ledger by remember { mutableStateOf(localLedger()) }
                var live by remember { mutableStateOf(false) }
                var refreshing by remember { mutableStateOf(false) }
                val haptics = LocalHapticFeedback.current

                // Main-thread Task listeners: no coroutines interop needed.
                fun doRefresh() {
                    refreshing = true
                    val db = tryFirestore()
                    if (db == null) {
                        ledger = localLedger(); live = false; refreshing = false
                        return
                    }
                    db.collection("invoices")
                        .orderBy("ts", Query.Direction.DESCENDING)
                        .limit(25).get()
                        .addOnSuccessListener { snap ->
                            ledger = snap.documents.map { d ->
                                Invoice(
                                    id = d.id,
                                    vendor = d.getString("vendor") ?: "—",
                                    total = (d.getDouble("total") ?: 0.0) / 100.0,
                                    flagged = d.getString("status") != "APPROVED",
                                )
                            }.ifEmpty { localLedger() }
                            live = true; refreshing = false
                        }
                        .addOnFailureListener {
                            ledger = localLedger(); live = false; refreshing = false
                        }
                }

                LaunchedEffect(Unit) { doRefresh() }

                Scaffold(
                    bottomBar = {
                        Button(
                            onClick = {
                                estopped = true
                                haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                            modifier = Modifier.fillMaxWidth().padding(16.dp).height(56.dp),
                        ) { Icon(Icons.Filled.Warning, null); Spacer(Modifier.width(8.dp)); Text("EMERGENCY STOP") }
                    }
                ) { pad ->
                    PullToRefreshBox(
                        isRefreshing = refreshing,
                        onRefresh = { doRefresh() },
                        state = rememberPullToRefreshState(),
                        modifier = Modifier.padding(pad),
                    ) {
                        LazyColumn(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            item {
                                ElevatedCard {
                                    Column(Modifier.padding(16.dp)) {
                                        Text("OVERHEAD FEED", style = MaterialTheme.typography.labelSmall)
                                        Text(
                                            if (estopped) "🔴 E-STOP LATCHED" else "🟢 PROCESSING · seal 9.2 kPa",
                                            style = MaterialTheme.typography.titleMedium,
                                        )
                                        Text(
                                            if (live) "● FIRESTORE LIVE" else "○ LOCAL SNAPSHOT",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = if (live) MaterialTheme.colorScheme.primary
                                            else MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                }
                            }
                            item {
                                ElevatedCard {
                                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                        Text("JOINT JOG", style = MaterialTheme.typography.labelSmall)
                                        joints.forEachIndexed { i, v ->
                                            HapticSlider(label = "q$i", value = v, onChange = { nv ->
                                                val m = joints.toMutableList(); m[i] = nv; joints = m
                                            })
                                        }
                                    }
                                }
                            }
                            items(ledger) { InvoiceCard(it) }
                        }
                    }
                }
            }
        }
    }
}
