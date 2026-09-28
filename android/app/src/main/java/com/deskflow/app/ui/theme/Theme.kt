package com.deskflow.app.ui.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Scheme = darkColorScheme(
    primary = Color(0xFFFBBF24),
    onPrimary = Color(0xFF09090B),
    surface = Color(0xFF101013),
    error = Color(0xFFF87171),
)

@Composable
fun DeskFlowTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Scheme, content = content)
}
