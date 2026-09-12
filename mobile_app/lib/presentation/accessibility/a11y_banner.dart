// Live-region banner (the Compose/ARIA `aria-live` equivalent).
//
// Legal alerts MUST be announced, not just shown: [assertive] banners go to
// a SemanticsFlag.liveRegion node that screen readers interrupt for;
// [polite] banners queue after the current utterance.

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';

class A11yBanner extends StatelessWidget {
  const A11yBanner.polite(this.text, {super.key})
      : assertive = false;

  const A11yBanner.assertive(this.text, {super.key})
      : assertive = true;

  final String text;
  final bool assertive;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      liveRegion: true,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        color: assertive
            ? scheme.errorContainer
            : scheme.surfaceContainerHighest,
        child: Row(
          children: [
            Icon(
              assertive ? Icons.warning_amber_rounded : Icons.info_outline,
              size: 20,
              color: scheme.onSurface,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                text,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Announce [message] through the framework semantics bridge
/// (screen readers) — for events that don't own banner space.
void announceForScreenReader(
  BuildContext context,
  String message, {
  bool assertive = false,
}) {
  SemanticsService.announce(
    message,
    TextDirection.rtl,
    assertiveness: assertive ? Assertiveness.assertive : Assertiveness.polite,
  );
}
