# Remix Games in Gallery

Lionnsgate wants the ability to feature the winning games from the game jam on the platform. These are not user submissions, they are not tied to any prompt, challenge, or platform user. They appear in the gallery grid alongside other content in a distinct format and have their own filter for easy access. Eventually they will also want to allow showing more games on platform, but that is now out of scope for the MVP and may be a fast follow.

- **Acceptance Criteria**
  - Admins can add Remix game links through the admin panel
  - Featured games appear in the gallery grid mixed in with other content
  - Games are visually distinguishable from user submissions
  - Games sort by their display date (or creation date in admin if unset) so they slot into the feed naturally rather than clustering
  - Tapping a game card opens an embedded playable game view, not the standard submission detail
  - Gallery "Type" filter includes a "Game" option

### Admin Entry

- Admin panel includes a lightweight flow to add a Remix game to the gallery
- New Page:
  - Gallery Features:
    - List of all featured items
      - Title
      - Thumbnail
      - Publish date
      - Delete and Edit CTA's on all items in the list
    - "New +" CTA
      - Required fields:
        - **Game URL**
          - link to the Remix game (used for embed)
        - **Title**
          - game title (manual entry, not pulled automatically)
        - **Thumbnail**
          - image upload for the gallery card
      - Optional fields:
        - **Display date**
          - controls sort position in the gallery when sorted by Newest. If not set, defaults to the time the entry was created in admin
          - this is neccessary to have some degree of control over how games are clustered in the gallery feed

- Admin can remove a featured game at any time

- Admins can edit select fields on a published item

### **Gallery Card**

- **Contains:**
  - Thumbnail
  - Title
- **Does not contain:**
  - author chip
    - these are not attributed to a platform user
  - like count, comment count, or back reference chip
  - LG Pick badge
    - not applicable to games imported from Remix

### **Detail View**

- On click of Remix game card:
  - **Contains:**
    - Remix game embed (playable in modal)
    - Game title
    - Close via X
  - **Does not contain:**
    - Author chip
    - Comment section
    - Like / share actions
    - Owner stats panel
    - Source back reference

- **Filtering**
  - In the gallery, games appear under the "Game" option in the Type dropdown filter
