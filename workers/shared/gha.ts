export interface GHEnv {
  GH_TOKEN: string
  GH_REPO: string
}

export interface GhaSubscription {
  chat_id: string
  urls: string[]
  force_send_all?: boolean
  hidden_items?: string[]
}

/**
 * 觸發 Github Actions 執行爬蟲，並控制是否強制作完整抓取
 * @param env 包含 GitHub config 的環境變數 
 * @param subscriptions 準備出發的訂閱陣列 (包含 chat_id 與 urls)
 * @param forceSendAll 若為 true，爬蟲將會一次性推播所有圖片與說明而不發送摘要
 */
export async function dispatchCrawler(
  env: GHEnv,
  subscriptions: Omit<GhaSubscription, 'force_send_all'>[],
  forceSendAll: boolean
): Promise<void> {
  // 將 bool 控制標記附加上去
  const payload: GhaSubscription[] = subscriptions.map(sub => ({
    ...sub,
    force_send_all: forceSendAll
  }))

  const resp = await fetch(
    `https://api.github.com/repos/${env.GH_REPO}/actions/workflows/crawl.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GH_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': '591-rent-bot',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: { subscriptions: JSON.stringify(payload) },
      }),
    }
  )

  if (!resp.ok) {
    const errorBody = await resp.text()
    throw new Error(`GHA Dispatch Failed: ${resp.status} ${errorBody}`)
  }
}
