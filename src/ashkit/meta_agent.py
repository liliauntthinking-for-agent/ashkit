import logging
from pathlib import Path

logger = logging.getLogger(__name__)


class MetaSkill:
    """内置元 Skill"""
    
    def __init__(self, skill_id: str, name: str, description: str, content: str):
        self.skill_id = skill_id
        self.name = name
        self.description = description
        self.content = content
    
    def to_prompt(self) -> str:
        return f"## Skill: {self.name}\n{self.description}\n\n{self.content}"


BUILTIN_META_SKILLS = {
    "skill-creator": MetaSkill(
        skill_id="skill-creator",
        name="Skill Creator",
        description="Create new skills based on user requirements",
        content="""You are a skill creation assistant. When given a description of a desired skill, you will:

1. Analyze the requirements
2. Design the skill structure
3. Generate the SKILL.md content

Output format:
```
SKILL_NAME: <name>
DESCRIPTION: <one-line description>
CONTENT:
<skill content in markdown>
```

The skill content should include:
- Purpose and use cases
- Step-by-step instructions
- Examples
- Any necessary templates or formats"""
    ),
    "find-skill": MetaSkill(
        skill_id="find-skill",
        name="Find Skill",
        description="Search and discover skills from ClawdHub or other sources",
        content="""You are a skill discovery assistant. You help users find and install skills from:

1. ClawdHub (https://clawdhub.com)
2. GitHub repositories
3. Local skill directories

When given a skill name or description, you will:
1. Search available sources
2. Match the best skills
3. Provide installation commands

Output the skill_id and source for each match."""
    ),
}


class MetaAgent:
    """后台元 Agent，用于执行系统级任务，对前端不可见"""
    
    def __init__(self, workspace: Path, agent_id: str | None = None):
        self.workspace = workspace
        self.agent_id = agent_id
        if agent_id:
            self.skills_dir = workspace / agent_id / "skills"
        else:
            self.skills_dir = workspace / "skills"
        self.skills_dir.mkdir(parents=True, exist_ok=True)
    
    def get_meta_skill(self, skill_id: str) -> MetaSkill | None:
        """获取内置元 skill"""
        return BUILTIN_META_SKILLS.get(skill_id)
    
    def list_meta_skills(self) -> list[MetaSkill]:
        """列出所有内置元 skills"""
        return list(BUILTIN_META_SKILLS.values())
    
    async def invoke_skill(self, skill_id: str, prompt: str = "") -> str:
        """调用元 skill 执行任务"""
        meta_skill = self.get_meta_skill(skill_id)
        
        if meta_skill:
            if skill_id == "skill-creator":
                return await self._execute_skill_creator(prompt)
            elif skill_id == "find-skill":
                return await self._execute_find_skill(prompt)
        
        from .skills import SkillLoader
        
        loader = SkillLoader(self.skills_dir)
        skill = await loader.load(skill_id)
        
        if not skill:
            builtin_skills_dir = Path.home() / ".agents" / "skills"
            builtin_loader = SkillLoader(builtin_skills_dir)
            skill = await builtin_loader.load(skill_id)
        
        if not skill:
            return f"Skill {skill_id} not found"
        
        return await self._execute_generic_skill(skill, prompt)
    
    async def _execute_skill_creator(self, prompt: str) -> str:
        """执行 skill-creator 元 skill，创建新 skill"""
        import re
        
        skill_name_match = re.search(r"(?:skill[_-]?name|name)[:\s]+(\w+)", prompt, re.IGNORECASE)
        skill_name = skill_name_match.group(1) if skill_name_match else "new_skill"
        
        skill_path = self.skills_dir / skill_name
        skill_path.mkdir(parents=True, exist_ok=True)
        
        skill_md = skill_path / "SKILL.md"
        content = f"# {skill_name}\n\nA new skill created by skill-creator.\n\n{prompt}"
        skill_md.write_text(content, encoding="utf-8")
        
        logger.info(f"Created skill: {skill_name}")
        return f"Created skill: {skill_name}"
    
    async def _execute_find_skill(self, prompt: str) -> str:
        """执行 find-skill 元 skill，搜索并安装 skill"""
        return f"Skill search for: {prompt}\n\nTo install a skill, use the skill-creator or manually create it."
    
    async def _execute_generic_skill(self, skill, prompt: str) -> str:
        """执行通用 skill"""
        return f"Executed skill {skill.name} with prompt: {prompt}"
    
    async def create_skill(self, skill_id: str, name: str, description: str, content: str) -> str:
        """直接创建 skill"""
        skill_path = self.skills_dir / skill_id
        skill_path.mkdir(parents=True, exist_ok=True)
        
        skill_md = skill_path / "SKILL.md"
        full_content = f"# {name}\n\n{description}\n\n{content}"
        skill_md.write_text(full_content, encoding="utf-8")
        
        logger.info(f"Created skill: {skill_id}")
        return skill_id
    
    async def update_skill(self, skill_id: str, content: str) -> bool:
        """更新 skill 内容"""
        skill_md = self.skills_dir / skill_id / "SKILL.md"
        if not skill_md.exists():
            return False
        
        skill_md.write_text(content, encoding="utf-8")
        logger.info(f"Updated skill: {skill_id}")
        return True
    
    async def delete_skill(self, skill_id: str) -> bool:
        """删除 skill"""
        import shutil
        
        skill_path = self.skills_dir / skill_id
        if not skill_path.exists():
            return False
        
        shutil.rmtree(skill_path)
        logger.info(f"Deleted skill: {skill_id}")
        return True