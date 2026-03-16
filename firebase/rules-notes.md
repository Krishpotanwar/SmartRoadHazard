# Firebase Rules — Important Notes

## Current Rules (Open — for demo only)
The rules.json sets `.read: true, .write: true` which allows anyone to read/write.

**This is intentional for a college demo project.**

## For Production
Change to authenticated rules before any public deployment:
```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

## How to Apply Rules
1. Go to Firebase Console → Realtime Database → Rules tab
2. Paste the content of rules.json
3. Click Publish
