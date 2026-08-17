# 资源提供方保持领域纯粹

## 背景

资源提供方（Manager、Service、Repo）管理自己的领域模型；调用方需要把这些对象交给另一个
系统时，很容易顺手把转换方法塞回提供方。

## 反例

```python
class SkillManager:
    def to_sandbox_skills(self) -> list[Skill]:
        return [
            Skill(resource_id=skill.resource_id, ...)
            for skill in self.list_skills()
        ]
```

`SkillManager` 因此依赖了 Sandbox 模型。调用方一变，资源提供方也被迫变化，领域边界失去纯粹性。

## 正例

```python
class ChatAgentFactory:
    def _start_sandbox(self):
        skills = [
            Skill(resource_id=skill.resource_id, zip_url=...)
            for skill in skill_manager.list_skills()
        ]
```

转换由同时了解两边模型的调用方负责；若逻辑复杂且多处复用，再提取独立 Adapter / Mapper。

## 关键判断

- 资源提供方只返回自己的领域模型。
- 数据转换由了解两侧的调用方负责。
- 复用需求成立时提取独立 Mapper，不把外部模型反向塞进提供方。

## 适用边界

若外部形态本身就是该资源领域公开契约的一部分，它不再是“调用方模型”，可以由领域层直接提供。
