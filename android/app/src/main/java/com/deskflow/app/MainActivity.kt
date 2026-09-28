package com.deskflow.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.dp
import com.deskflow.app.ui.components.HapticSlider
import com.deskflow.app.ui.components.InvoiceCard
import com.deskflow.app.ui.theme.DeskFlowTheme

data class Invoice(val id: String, val vendor: String, val total: Double, val flagged: Boolean)

/** Material 3 edge monitor: live feed placeholder, joint jog, Firestore ledger, E-stop. */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            DeskFlowTheme {
                var estopped by remember { mutableStateOf(false) }
                var joints by remember { mutableStateOf(listOf(0.42f, -0.61f, 1.05f, 0.0f)) }
                val ledger = remember {
                    listOf(
                        Invoice("INV-2041", "Acme Corp", 118.00, false),
                        Invoice("INV-2042", "Globex", 425.00, true),
                    )
                }
                val haptics = LocalHapticFeedback.current

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
                    LazyColumn(Modifier.padding(pad).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        item {
                            ElevatedCard {
                                Column(Modifier.padding(16.dp)) {
                                    Text("OVERHEAD FEED", style = MaterialTheme.typography.labelSmall)
                                    Text(if (estopped) "🔴 E-STOP LATCHED" else "🟢 PROCESSING · seal 9.2 kPa",
                                        style = MaterialTheme.typography.titleMedium)
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
