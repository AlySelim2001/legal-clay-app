package net.crimsys.app.ui.screens.legal

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun ArticleDetailScreen(
    documentId: String,
    onBack: () -> Unit,
    viewModel: LegalSearchViewModel = hiltViewModel(),
) {
    val document by viewModel.observeDocument(documentId).collectAsStateWithLifecycle(initialValue = null)
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "رجوع") }
        val item = document
        if (item == null) {
            Text("النص القانوني غير متاح محلياً", color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
            Text(item.title, style = MaterialTheme.typography.headlineSmall)
            Text(
                listOfNotNull(item.lawNumber?.let { "قانون $it" }, item.articleNumber?.let { "مادة $it" })
                    .joinToString(" • "),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
            )
            Text(item.body, style = MaterialTheme.typography.bodyLarge)
            item.sourceUrl?.let { Text("المصدر الرسمي: $it", style = MaterialTheme.typography.bodySmall) }
        }
    }
}
