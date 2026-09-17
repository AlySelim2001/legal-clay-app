package net.crimsys.app.ui.components.state

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable fun EmptyState(message: String, actionLabel: String? = null, onAction: (() -> Unit)? = null) {
    Column(Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant); if (actionLabel != null && onAction != null) Button(onClick = onAction) { Text(actionLabel) } }
}
@Composable fun ErrorState(message: String, onRetry: (() -> Unit)? = null) { Column(Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { Text(message, color = MaterialTheme.colorScheme.error); if (onRetry != null) Button(onClick = onRetry) { Text("رجوع") } } }
@Composable fun OfflineState() { Text("أنت غير متصل. البيانات المحلية متاحة وستتم المزامنة لاحقاً.", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(8.dp)) }
@Composable fun SyncPendingState(count: Int) { Text("تم الحفظ محلياً — بانتظار المزامنة ($count)", color = MaterialTheme.colorScheme.secondary, modifier = Modifier.padding(8.dp)) }
