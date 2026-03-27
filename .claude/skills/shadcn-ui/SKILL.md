---
name: shadcn-ui
description: Use when working with shadcn/ui components, forms, theming, or UI layout. Covers installation, composition patterns, CLI commands, and project-specific configuration.
---

# shadcn/ui Skill

## Project Context
Before generating shadcn/ui code, run `npx shadcn@latest info --json` to get the project's framework, Tailwind version, aliases, base library, icon library, and installed components.

## CLI Commands
- `npx shadcn@latest add <component>` — Add a component
- `npx shadcn@latest add --all` — Add all components
- `npx shadcn@latest search <query>` — Search components
- `npx shadcn@latest docs <component>` — View component docs
- `npx shadcn@latest diff` — Check for updates

## Rules
- Always check installed components before adding new ones
- Use `FieldGroup` for forms, `ToggleGroup` for option sets
- Use semantic color variables (--primary, --destructive, etc.)
- Use `asChild` on triggers: `<DialogTrigger aston>Open</Button></DialogTrigger>`
- Wrap inputs in `<FormControl>` inside form fields
- Add `aria-label` on icon-only buttons
- Import from `@/components/ui/<component>`
