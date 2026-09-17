import re

file_path = 'src/services/authorization/configs/workspace-roles.config.ts'
with open(file_path, 'r') as f:
    content = f.read()

# Insert WORKSPACE_GUEST before the final closing brace
guest_role = """
  WORKSPACE_GUEST: {
    key: "WORKSPACE_GUEST",
    name: "Guest",
    description: "External members invited only to specific projects. Cannot see other workspace members or projects.",
    permissions: [
      PERMISSIONS.WORKSPACE.READ
    ],
  },
} satisfies"""

content = content.replace("} satisfies", guest_role)

with open(file_path, 'w') as f:
    f.write(content)
