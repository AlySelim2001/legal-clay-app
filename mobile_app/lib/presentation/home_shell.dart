// Bottom navigation shell — five clay tabs, RTL order.

import 'package:flutter/material.dart';

import 'about/about_page.dart';
import 'assistant/assistant_page.dart';
import 'deadlines/deadlines_page.dart';
import 'emergency/emergency_page.dart';
import 'scanner/scanner_page.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  void _go(int i) => setState(() => _index = i);

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      EmergencyPage(onNavigate: _go),
      const ScannerPage(),
      const AssistantPage(),
      const DeadlinesPage(),
      const AboutPage(),
    ];
    return Scaffold(
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: _go,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.emergency_share_outlined),
            selectedIcon: Icon(Icons.emergency_share),
            label: 'الاستغاثة',
          ),
          NavigationDestination(
            icon: Icon(Icons.document_scanner_outlined),
            selectedIcon: Icon(Icons.document_scanner),
            label: 'مسح مستند',
          ),
          NavigationDestination(
            icon: Icon(Icons.forum_outlined),
            selectedIcon: Icon(Icons.forum),
            label: 'المساعد',
          ),
          NavigationDestination(
            icon: Icon(Icons.hourglass_bottom_outlined),
            selectedIcon: Icon(Icons.hourglass_bottom),
            label: 'المواعيد',
          ),
          NavigationDestination(
            icon: Icon(Icons.info_outline),
            selectedIcon: Icon(Icons.info),
            label: 'حول',
          ),
        ],
      ),
    );
  }
}
