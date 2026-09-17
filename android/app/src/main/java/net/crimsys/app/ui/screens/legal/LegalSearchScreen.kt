package net.crimsys.app.ui.screens.legal

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import net.crimsys.app.domain.legal.LegalDocument

@Composable
fun LegalSearchScreen(viewModel: LegalSearchViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        OutlinedTextField(
            value = state.query,
            onValueChange = viewModel::onQueryChanged,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            label = { Text("بحث في القوانين المصرية") },
            placeholder = { Text("اسم القانون أو رقم المادة أو النص") },
        )

        state.selectedDocument?.let { document ->
            LegalDocumentDetail(document, viewModel::clearSelection)
        } ?: run {
            if (state.results.isEmpty()) {
                Text(
                    text = if (state.query.isBlank()) {
                        "لا توجد نصوص قانونية محلية متاحة"
                    } else {
                        "لا توجد نتائج مطابقة"
                    },
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(state.results, key = LegalDocument::id) { document ->
                        LegalDocumentCard(document) { viewModel.selectDocument(document.id) }
                    }
                }
            }
        }
    }
}

@Composable
private fun LegalDocumentCard(document: LegalDocument, onClick: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(document.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(4.dp))
            Text(
                listOfNotNull(document.lawNumber?.let { "قانون $it" }, document.articleNumber?.let { "مادة $it" })
                    .joinToString(" • "),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.height(6.dp))
            Text(document.body, maxLines = 3, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun LegalDocumentDetail(document: LegalDocument, onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize()) {
        Row(modifier = Modifier.fillMaxWidth()) {
            IconButton(onClick = onBack) {
                Icon(Icons.Default.ArrowBack, contentDescription = "رجوع")
            }
            Text(document.title, modifier = Modifier.padding(top = 12.dp), style = MaterialTheme.typography.titleLarge)
        }
        Spacer(Modifier.height(12.dp))
        Text(document.body, style = MaterialTheme.typography.bodyLarge)
        document.sourceUrl?.let { source ->
            Spacer(Modifier.height(16.dp))
            Text("المصدر الرسمي: $source", style = MaterialTheme.typography.bodySmall)
        }
    }
}
