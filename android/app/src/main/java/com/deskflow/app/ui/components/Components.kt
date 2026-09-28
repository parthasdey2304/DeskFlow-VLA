package com.deskflow.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.dp
import com.deskflow.app.Invoice

@Composable
fun InvoiceCard(inv: Invoice) {
    ElevatedCard {
        Row(Modifier.padding(16.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Column {
                Text("${inv.id} · ${inv.vendor}", style = MaterialTheme.typography.titleSmall)
                Text("₹%.2f".format(inv.total), style = MaterialTheme.typography.bodySmall)
            }
            AssistChip(
                onClick = {},
                label = { Text(if (inv.flagged) "FLAGGED_DISCREPANCY" else "APPROVED") },
                colors = AssistChipDefaults.assistChipColors(
                    containerColor = if (inv.flagged) MaterialTheme.colorScheme.errorContainer
                    else MaterialTheme.colorScheme.primaryContainer,
                ),
            )
        }
    }
}

@Composable
fun HapticSlider(label: String, value: Float, onChange: (Float) -> Unit) {
    val haptics = LocalHapticFeedback.current
    Column {
        Text("$label  ${"%.2f".format(value)} rad", style = MaterialTheme.typography.bodySmall)
        Slider(
            value = value, onValueChange = { onChange(it) },
            valueRange = -2.6f..2.6f,
            onValueChangeFinished = { haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove) },
            modifier = Modifier.height(44.dp),
        )
    }
}
