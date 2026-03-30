---
name: map-route-reader
description: |
  Read public transit, driving, and walking routes from map sites such as Amap/Baidu Maps. Use when the user asks how to get from one place to another, how long it takes, what public transit route to take, or whether an alternative line/route would be better.
---

# Map Route Reader

Use this skill when the user asks for:
- how to get from A to B
- public transit routes
- driving time
- walking time
- which station to transfer at
- whether taxi is faster
- whether a specific alternate route/line would be better
- route comparisons such as “走 14 号线会不会更好”

## Goal

Return a route the user can actually follow.
Do not stop at vague estimates when a real route can be extracted.

Priority:
1. exact route from a real map result
2. if the user proposes an alternate route/line, extract that route too and compare side by side
3. if exact route cannot be extracted, explain precisely where extraction failed and switch to the user-browser map tab via Browser Relay
4. only as a temporary fallback, give a clearly-labeled estimate

## Preferred workflow

### 0) For Amap, prefer `uriapi` route pages with `lnglat` when coordinates are available
If you can get origin/destination coordinates, prefer opening a direct Amap route URL like:
`https://ditu.amap.com/dir?type=bus&policy=2&from[lnglat]=<lng,lat>&from[name]=...&to[lnglat]=<lng,lat>&to[name]=...&src=uriapi&innersrc=uriapi&dateTime=now`

Why:
- this bypasses wrong default city context
- the route card often renders directly in page text
- total duration / walking distance / fare / line names can often be extracted from `document.body.innerText`

### 1) Try normal read first
- Use browser on public map pages first.
- Prefer Amap or Baidu Maps for China routes.
- Try direct route pages with origin/destination query params.
- If the page exposes the full route card, extract:
  - total time
  - total walking time if visible
  - number of transfers
  - station names / line names
  - final arrival station or walking segment

### 1.5) On Amap route pages, extract hidden detail siblings
After the recommended route card renders, the full step-by-step transit detail may exist in the hidden sibling node right after the current `.planTitle` (for example an `ol.p_route`).
Do not stop at total duration. Read that hidden detail block and extract:
- walking segment distance and minutes
- line name and direction
- boarding station and exit/gate info
- number of stops
- transfer station
- alighting station and exit number
- final walking segment to destination
- approximate duration of each transit segment when the page exposes enough information to infer it

### 2) If the map page needs interaction
If the site asks to confirm the start/end place, or the route card is hidden behind dynamic UI:
- keep using browser
- interact to confirm the correct start/end point
- prefer the first recommended public transit route unless the user asked for fastest/least walking/least transfers

### 3) For China map sites, prefer the user's real map tab when city context matters
For Amap/Baidu route pages, the isolated browser may resolve the wrong city or fail to expand the route card.
If the page shows the wrong city, cannot resolve start/end places, or keeps asking to choose the correct place, switch early to the user's map tab via Browser Relay and read the live route result there.

### 4) If normal browser still cannot read the real route
Switch to the user’s browser tab via Browser Relay.
- Ask the user to open the target map route page in Chrome.
- Ask them to click Browser Relay on the exact map tab.
- Then read the real route card from that tab.

## Comparison rule

If the user asks whether a specific route/line would be better, for example:
- “走 14 号线会不会更好”
- “打车会不会更方便”
- “xx 这么走是不是更好”

then you must:
1. keep the current recommended route
2. extract the user-specified route too
3. present a side-by-side comparison

Do not guess. Do not answer from intuition alone.
Do not say “应该不会” or “大概率更慢” unless the alternate route has been pulled out and compared.

## Output format

For a single route, return in this structure:
- 起点：...
- 终点：...
- 方式：公交 / 地铁 / 打车 / 步行
- 预计总时长：...
- 推荐路线：...
- 换乘：...
- 每段步骤：...
- 下车后：...
- 备注：如有不确定，明确写出来

If route detail is available, include:
- 上车站
- 下车站
- 换乘站
- 出口
- 每段步行距离与时间
- 每段乘车站数
- 每段乘车大约多久

For a route comparison, return side-by-side:
- 方案 A
- 方案 B
- 总时长
- 步行距离
- 换乘次数
- 线路结构
- 哪个更快 / 哪个更省事 / 哪个更少走路

## Rules

- Do not stop at “I’ll check” or “probably around ...” unless exact extraction has genuinely failed.
- If exact extraction failed, say which step failed.
- For map queries, a user-visible answer should try to be route-usable.
- If the user corrected the place name, restart from the corrected place immediately.
- If the user corrected the place name, never reuse the old route result as if it applied to the corrected place.
- For comparison questions, do not brain-fill the alternate route. Pull it out, then compare.
