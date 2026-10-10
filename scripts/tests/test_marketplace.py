import importlib.util
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("marketplace", ROOT / "scripts/check_marketplace.py")
marketplace = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(marketplace)


class MarketplaceTest(unittest.TestCase):
    def test_shipped_indexes(self):
        self.assertEqual(marketplace.check(ROOT), [])

    def test_missing_plugin_and_index_divergence(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            for path in (".claude-plugin", ".agents/plugins"):
                (root / path).mkdir(parents=True)
                (root / path / "marketplace.json").write_text('{"plugins":[]}')
            self.assertEqual(marketplace.check(root), [])
            (root / ".claude-plugin/marketplace.json").write_text(json.dumps({"plugins": [{"name": "missing", "source": "./missing"}]}))
            failures = marketplace.check(root)
            self.assertTrue(any("missing manifest" in item for item in failures))
            self.assertIn("Claude and Codex plugin indexes differ", failures)
