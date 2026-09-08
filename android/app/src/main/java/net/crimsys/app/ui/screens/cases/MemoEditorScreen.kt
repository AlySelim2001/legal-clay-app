package net.crimsys.app.ui.screens.cases

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.FormatBold
import androidx.compose.material.icons.filled.FormatItalic
import androidx.compose.material.icons.filled.FormatListBulleted
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.mohamedrejeb.richeditor.ui.material3.RichTextEditor
import net.crimsys.app.R
import net.crimsys.app.core.AppError
import net.crimsys.app.ui.components.clayInset
import net.crimsys.app.ui.theme.ClayPrimary

/**
 * Rich-text legal memo editor (com.mohamedrejeb.richeditor).
 *
 * Arabic-first: the editor resolves per-paragraph direction from the typed
 * content, so Arabic text lays out RTL natively without forcing
 * CompositionLocalProvider. The toolbar toggles bold / italic / bulleted
 * list on the current selection.
 */
@Composable
fun MemoEditorScreen(
    caseId: String,
    onBack: () -> Unit,
    viewModel: MemoEditorViewModel = hiltViewModel(),
) {
    LaunchedEffect(caseId) { viewModel.load(caseId) }

    val richText by viewModel.richText.collectAsState()
    val linkedCaseId by viewModel.caseId.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            val message = when (event) {
                MemoEditorViewModel.Event.Saved -> context.getString(R.string.memo_saved)
                MemoEditorViewModel.Event.NoCase, MemoEditorViewModel.Event.LoadFailed ->
                    context.getString(R.string.memo_no_case)
                is MemoEditorViewModel.Event.SaveFailed ->
                    when (val error = event.error) {
                        is AppError.Validation -> error.message
                        else -> context.getString(R.string.error_unknown)
                    }
            }
            snackbarHostState.showSnackbar(message)
        }
    }

    Box(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
        ) {
            // ── Header ──────────────────────────────────────────────────────
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBack) {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = stringResource(R.string.menu_open_drawer),
                    )
                }
                Text(
                    text = stringResource(R.string.memo_title),
                    style = MaterialTheme.typography.headlineSmall,
                    modifier = Modifier.weight(1f),
                )
            }

            // ── Toolbar ─────────────────────────────────────────────────────
            Row(
                Modifier
                    .fillMaxWidth()
                    .clayInset(RoundedCornerShape(16.dp))
                    .padding(horizontal = 4.dp, vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Read inside composition: RichTextState exposes snapshot-backed
                // properties, so these flags recompose as the selection moves.
                val isBold = richText.currentSpanStyle.fontWeight == FontWeight.Bold
                val isItalic = richText.currentSpanStyle.fontStyle == androidx.compose.ui.text.font.FontStyle.Italic

                IconButton(onClick = viewModel::toggleBold) {
                    Icon(
                        Icons.Filled.FormatBold,
                        contentDescription = stringResource(R.string.memo_bold),
                        tint = if (isBold) ClayPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                IconButton(onClick = viewModel::toggleItalic) {
                    Icon(
                        Icons.Filled.FormatItalic,
                        contentDescription = stringResource(R.string.memo_italic),
                        tint = if (isItalic) ClayPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                IconButton(onClick = viewModel::toggleUnorderedList) {
                    Icon(
                        Icons.Filled.FormatListBulleted,
                        contentDescription = null,
                        tint = if (richText.isUnorderedList) ClayPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                Spacer(Modifier.weight(1f))

                Button(onClick = viewModel::save) {
                    Icon(Icons.Filled.Save, contentDescription = null)
                    Spacer(Modifier.width(6.dp))
                    Text(stringResource(R.string.save))
                }
            }

            Spacer(Modifier.height(10.dp))

            // ── Editor ──────────────────────────────────────────────────────
            if (linkedCaseId.isNullOrBlank()) {
                Text(
                    text = stringResource(R.string.memo_no_case),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                RichTextEditor(
                    state = richText,
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            Spacer(Modifier.height(24.dp))
        }

        SnackbarHost(snackbarHostState, Modifier.align(Alignment.BottomCenter))
    }
}
