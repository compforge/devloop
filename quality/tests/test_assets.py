import importlib.util
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("quality_assets", ROOT / "scripts/check_assets.py")
assets = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(assets)


class AssetsTest(unittest.TestCase):
    def fixture(self, root):
        for kind in (".claude-plugin", ".codex-plugin"):
            (root / kind).mkdir()
            (root / kind / "plugin.json").write_text(json.dumps({"name": "quality", "version": "1.0.0"}))
        skill = root / "skills/example"
        (skill / "agents").mkdir(parents=True)
        (skill / "SKILL.md").write_text("---\nname: example\ndescription: A test skill\n---\n[Guide](guide.md)\n")
        (skill / "guide.md").write_text("Guide\n")
        (skill / "agents/openai.yaml").write_text('interface:\n  default_prompt: "Use $example"\n')
        return skill

    def test_shipped_assets(self):
        self.assertEqual(assets.check(ROOT), [])

    def test_broken_reference_and_skill_metadata_are_reported(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            skill = self.fixture(root)
            self.assertEqual(assets.check(root), [])
            (skill / "guide.md").unlink()
            (skill / "SKILL.md").write_text("---\nname: wrong\ndescription: Test\n---\n[Guide](guide.md)\n")
            failures = assets.check(root)
            self.assertTrue(any("missing link" in item for item in failures))
            self.assertTrue(any("name must match" in item for item in failures))

    def test_versions_must_agree(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            (root / ".codex-plugin/plugin.json").write_text('{"name":"quality","version":"2.0.0"}')
            self.assertIn("plugin versions differ", assets.check(root))
