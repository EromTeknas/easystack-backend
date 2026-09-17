import re

file_path = '/home/eteknas/Projects/easystack-backend/src/services/email.service.ts'
with open(file_path, 'r') as f:
    content = f.read()

dark_style = """
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background-color: #0e1116; color: #e1e4e8; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; padding: 32px; background-color: #161b22; border: 1px solid #30363d; border-radius: 12px; }
          .header { text-align: center; margin-bottom: 32px; }
          .header h2 { color: #f0f6fc; font-weight: 600; margin-top: 0; }
          .header h1 { color: #f0f6fc; font-weight: 600; margin-top: 0; }
          p { line-height: 1.6; color: #c9d1d9; }
          .button { 
            display: inline-block; 
            background-color: #2f81f7; 
            color: #ffffff; 
            padding: 12px 24px; 
            border-radius: 6px; 
            text-decoration: none;
            font-weight: 600;
            margin: 24px 0;
            text-align: center;
          }
          .button:hover { background-color: #1f6feb; }
          .footer { font-size: 12px; color: #8b949e; margin-top: 48px; text-align: center; border-top: 1px solid #30363d; padding-top: 24px; }
          .otp-code { 
            font-size: 36px; 
            font-weight: 700; 
            color: #58a6ff; 
            letter-spacing: 8px;
            text-align: center;
            padding: 24px;
            background-color: #0d1117;
            border: 1px solid #30363d;
            border-radius: 8px;
            margin: 32px 0;
          }
"""

content = re.sub(r'<style>.*?</style>', f'<style>{dark_style}</style>', content, flags=re.DOTALL)
# Remove the gradient inline style
content = content.replace('class="header" style="background: linear-gradient(135deg, #0066cc 0%, #004499 100%); color: white; padding: 30px; border-radius: 8px;"', 'class="header"')
content = content.replace('class="header" style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;"', 'class="header"')

with open(file_path, 'w') as f:
    f.write(content)
print("Emails updated.")
