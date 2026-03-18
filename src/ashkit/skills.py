import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class Skill:
    def __init__(self, name: str, description: str, content: str, path: Path):
        self.name = name
        self.description = description
        self.content = content
        self.path = path

    def to_prompt(self) -> str:
        return f"## Skill: {self.name}\n{self.description}\n\n{self.content}"


class SkillLoader:
    def __init__(self, skills_dir: Path):
        self.skills_dir = skills_dir

    async def load_all(self) -> list[Skill]:
        if not self.skills_dir.exists():
            return []

        skills = []
        for skill_path in self.skills_dir.iterdir():
            if skill_path.is_dir():
                skill_md = skill_path / "SKILL.md"
                if skill_md.exists():
                    skill = await self._load_skill(skill_md, skill_path.name)
                    if skill:
                        skills.append(skill)
        return skills

    async def _load_skill(self, path: Path, name: str) -> Skill | None:
        try:
            content = path.read_text(encoding="utf-8")
            lines = content.split("\n")
            description = ""
            for line in lines[1:]:
                if line.strip():
                    description = line.strip()
                    break

            return Skill(name=name, description=description, content=content, path=path)
        except Exception as e:
            logger.warning(f"Failed to load skill {name}: {e}")
            return None

    async def load(self, name: str) -> Skill | None:
        skill_path = self.skills_dir / name / "SKILL.md"
        if not skill_path.exists():
            return None
        return await self._load_skill(skill_path, name)

    async def reload(self, name: str):
        return await self.load(name)
