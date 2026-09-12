// Document scanner — camera capture → local OCR service.
//
// HONEST PIPELINE: exactly the stages that exist — capture, upload, OCR text.
// Stamp/tamper forensics are server capabilities (SSIM endpoint); this screen
// never shows fake "YOLO detection" stages for a model that isn't shipped.

import 'dart:typed_data';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_error.dart';
import '../../core/constants.dart';
import '../accessibility/a11y_banner.dart';
import '../voice/voice_gateway.dart';
import '../../data/backend/backend_client.dart';
import '../main_container.dart';

enum ScanStage { idle, capturing, uploading, done, failed }

class ScannerPage extends StatefulWidget {
  const ScannerPage({super.key});

  @override
  State<ScannerPage> createState() => _ScannerPageState();
}

class _ScannerPageState extends State<ScannerPage> {
  CameraController? _controller;
  ScanStage _stage = ScanStage.idle;
  String? _errorAr;
  String? _ocrText;
  List<CameraDescription> _cameras = const [];

  @override
  void initState() {
    super.initState();
    _initCamera();
  }

  Future<void> _initCamera() async {
    try {
      _cameras = await availableCameras();
      if (_cameras.isEmpty) {
        setState(() => _errorAr = 'لا توجد كاميرا متاحة على هذا الجهاز');
        return;
      }
      final back = _cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => _cameras.first,
      );
      final controller = CameraController(back, ResolutionPreset.high);
      await controller.initialize();
      if (!mounted) return;
      setState(() => _controller = controller);
    } on CameraException {
      setState(() => _errorAr = 'تعذر تشغيل الكاميرا — تحقق من الإذن');
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _captureAndScan() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    setState(() {
      _stage = ScanStage.capturing;
      _errorAr = null;
      _ocrText = null;
    });
    try {
      final file = await controller.takePicture();
      final bytes = await file.readAsBytes();
      if (!mounted) return;
      setState(() => _stage = ScanStage.uploading);

      final container = context.read<AppContainer>();
      final result =
          await container.backend.scanDocument(Uint8List.fromList(bytes));
      if (!mounted) return;
      setState(() {
        _ocrText = result.text;
        _stage = ScanStage.done;
      });
      final voice = context.read<VoiceGateway>();
      await voice.speak('تم قراءة المستند. سيُعرض النص الآن مع إخفاء أي بيانات شخصية.');
    } on AppError catch (e) {
      if (!mounted) return;
      setState(() {
        _stage = ScanStage.failed;
        _errorAr = e.messageAr;
      });
    } on CameraException {
      if (!mounted) return;
      setState(() {
        _stage = ScanStage.failed;
        _errorAr = 'فشل التقاط الصورة — أعد المحاولة';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text('مسح مستند',
                style: Theme.of(context).textTheme.titleLarge),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(28),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (_controller != null &&
                        _controller!.value.isInitialized)
                      CameraPreview(_controller!)
                    else
                      Container(
                        color: scheme.surfaceContainerHighest,
                        alignment: Alignment.center,
                        child: Text(
                          _errorAr ?? 'جارٍ تحضير الكاميرا…',
                          textAlign: TextAlign.center,
                        ),
                      ),
                    // Framing guide with spoken-style instruction.
                    Align(
                      alignment: Alignment.topCenter,
                      child: Container(
                        margin: const EdgeInsets.all(12),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.black54,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Text(
                          'قرّب الكاميرا من الإيصال وتأكد من الإضاءة',
                          style: TextStyle(color: Colors.white),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                if (_stage == ScanStage.uploading)
                  const LinearProgressIndicator(minHeight: 6),
                FilledButton.icon(
                  onPressed: _stage == ScanStage.capturing ||
                          _stage == ScanStage.uploading
                      ? null
                      : _captureAndScan,
                  icon: const Icon(Icons.camera_alt, size: 28),
                  label: Text(
                    _stage == ScanStage.done
                        ? 'التقاط صورة أخرى'
                        : 'صوّر واقرأ المستند',
                  ),
                ),
                if (_errorAr != null && _stage == ScanStage.failed)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: A11yBanner.assertive(_errorAr!),
                  ),
                if (_ocrText != null) ...[
                  const SizedBox(height: 8),
                  A11yBanner.polite(
                      'النص المُستخرج يمر عبر بوابة إخفاء البيانات الشخصية على الخادم قبل أي معالجة.'),
                  const SizedBox(height: 8),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Text(_ocrText!),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
