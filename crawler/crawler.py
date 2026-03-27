#!/usr/bin/env python3
"""
591租屋網爬蟲 — Telegram Bot 版
從 GitHub Actions workflow_dispatch input 讀取訂閱清單
爬完後直接推播給對應的 Telegram chat_id
"""
import asyncio
import json
import os
import httpx
from playwright.async_api import async_playwright

SUBSCRIPTIONS: list[dict] = json.loads(os.environ["SUBSCRIPTIONS"])
BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
TELEGRAM_API = f"https://api.telegram.org/bot{BOT_TOKEN}"

EXTRACT_JS = """
    () => {
        const itemElements = Array.from(document.querySelectorAll('[data-id]'));
        return itemElements.map(item => {
            const dataId = item.getAttribute('data-id');
            const titleEl = item.querySelector('.item-title, [class*="title"]');
            const title = titleEl?.textContent?.trim() || '';
            const priceEl = item.querySelector('.item-price, [class*="price"]');
            const price = priceEl?.textContent?.trim() || '';
            const imgEl = item.querySelector('img');
            const image = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '';
            const linkEl = item.querySelector('a');
            const link = linkEl?.getAttribute('href') || '';
            const allText = item.textContent?.trim() || '';
            const layoutMatch = allText.match(/(\\d+房\\d+廳)/);
            const layout = layoutMatch ? layoutMatch[1] : '';
            const areaMatch = allText.match(/(\\d+\\.?\\d*坪)/);
            const area = areaMatch ? areaMatch[1] : '';
            const floorMatch = allText.match(/(\\d+F\\/\\d+F)/);
            const floor = floorMatch ? floorMatch[1] : '';
            const lineEls = Array.from(item.querySelectorAll('span.line'));
            const updateEl = lineEls.find(el => el.textContent.includes('更新'));
            const updateTime = updateEl ? updateEl.textContent.trim() : '';
            return { id: dataId, title, price, layout, area, floor,
                     update_time: updateTime, image, link };
        });
    }
"""


async def crawl_591(browser, url: str) -> list:
    page = await browser.new_page()
    print(f"  訪問: {url}")
    try:
        await page.goto(url)
        await page.wait_for_timeout(2000)
        try:
            close_button = page.locator('button:has-text("×")').first
            if await close_button.is_visible():
                await close_button.click()
        except Exception:
            pass
        await page.evaluate("window.scrollTo(0, 1200)")
        await page.wait_for_timeout(3000)
        items = await page.evaluate(EXTRACT_JS)
        print(f"  抓到 {len(items)} 筆")
        return items
    finally:
        await page.close()


async def send_telegram(chat_id: str, items: list) -> None:
    if not items:
        print(f"  [chat_id={chat_id}] 無新結果，跳過推播")
        return

    async with httpx.AsyncClient(timeout=30) as client:
        # 先推播摘要
        summary = f"找到 {len(items)} 筆新房源："
        resp = await client.post(f"{TELEGRAM_API}/sendMessage", json={
            "chat_id": chat_id,
            "text": summary,
        })
        print(f"  摘要推播狀態: {resp.status_code} {resp.text}")

        # 每筆獨立推播（最多 20 筆避免洗版）
        for item in items[:20]:
            link = item.get('link', '')
            if link and not link.startswith('http'):
                link = f"https://rent.591.com.tw{link}"

            text = (
                f"*{item.get('title', '(無標題)')}*\n"
                f"{item.get('price', '')}  {item.get('layout', '')}  {item.get('area', '')}\n"
                f"{item.get('floor', '')}  更新：{item.get('update_time', '')}\n"
                f"{link}"
            )
            resp = await client.post(f"{TELEGRAM_API}/sendMessage", json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "Markdown",
                "disable_web_page_preview": False,
            })
            print(f"  推播狀態: {resp.status_code} | {resp.text[:100]}")
            await asyncio.sleep(0.3)  # 避免打太快


async def main():
    print(f"開始處理 {len(SUBSCRIPTIONS)} 個訂閱")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        for sub in SUBSCRIPTIONS:
            chat_id = str(sub["chat_id"])
            urls: list[str] = sub["urls"]
            print(f"\n[chat_id={chat_id}] 共 {len(urls)} 個 URL")

            try:
                all_items = []
                seen_ids: set[str] = set()

                for url in urls:
                    items = await crawl_591(browser, url)
                    for item in items:
                        if item["id"] not in seen_ids:
                            seen_ids.add(item["id"])
                            all_items.append(item)

                print(f"  合計 {len(all_items)} 筆（去重後）")
                await send_telegram(chat_id, all_items)
                print(f"  [OK] 推播完成")

            except Exception as e:
                print(f"  [ERROR] chat_id={chat_id} 失敗，跳過：{e}")
                continue

        await browser.close()

    print("\n全部完成")


if __name__ == "__main__":
    asyncio.run(main())
