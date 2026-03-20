import type { RuntimeContext } from "../../../types/runtime-context.ts";
import type { Lang } from "../../../types/lang.ts";
import type { AgentRow } from "./direct-chat.ts";

type L10n = Record<Lang, string[]>;

type ChatResponseDeps = {
  db: RuntimeContext["db"];
  resolveLang: (text?: string, fallback?: Lang) => Lang;
  getDeptName: (deptId: string) => string;
  getRoleLabel: (role: string, lang: Lang) => string;
  pickRandom: <T>(arr: T[]) => T;
  getFlairs: (agentName: string, lang: Lang) => string[];
  classifyIntent: (msg: string, lang: Lang) => Record<string, boolean>;
  l: (ko: string[], en: string[], ja?: string[], zh?: string[], ru?: string[]) => L10n;
  pickL: (pool: L10n, lang: Lang) => string;
};

export function createChatReplyGenerator(deps: ChatResponseDeps): {
  generateChatReply: (agent: AgentRow, ceoMessage: string) => string;
} {
  const { db, resolveLang, getDeptName, getRoleLabel, pickRandom, getFlairs, classifyIntent, l, pickL } = deps;

  function generateChatReply(agent: AgentRow, ceoMessage: string): string {
    const msg = ceoMessage.trim();
    const lang = resolveLang(msg);
    const name = lang === "ko" ? agent.name_ko || agent.name : agent.name;
    const dept = agent.department_id ? getDeptName(agent.department_id) : "";
    const role = getRoleLabel(agent.role, lang);
    const nameTag = dept
      ? lang === "ko"
        ? `${dept} ${role} ${name}`
        : `${name}, ${role} of ${dept}`
      : `${role} ${name}`;
    const flairs = getFlairs(agent.name, lang);
    const flair = () => pickRandom(flairs);
    const intent = classifyIntent(msg, lang);

    let taskTitle = "";
    if (agent.current_task_id) {
      const t = db.prepare("SELECT title FROM tasks WHERE id = ?").get(agent.current_task_id) as
        | { title: string }
        | undefined;
      if (t) taskTitle = t.title;
    }

    if (agent.status === "offline")
      return pickL(
        l(
          [`[Auto-reply] ${name} is currently offline. I'll check when I'm back.`],
          [`[Auto-reply] ${name} is currently offline. I'll check when I'm back.`],
          [`[自動応答] ${name}は現在オフラインです。復帰後確認します。`],
          [`[自动回复] ${name}目前离线，回来后会确认。`],
        ),
        lang,
      );

    if (agent.status === "break") {
      if (intent.presence)
        return pickL(
          l(
            [
              `Oh! I just stepped out for coffee. I'm back now! ☕`,
              `Yes! I was on a short break but I'm here. What do you need?`,
              `I'm here! Just took a quick breather. What's up? 😊`,
            ],
            [
              `Oh! I just stepped out for coffee. I'm back now! ☕`,
              `Yes! I was on a short break but I'm here. What do you need?`,
              `I'm here! Just took a quick breather. What's up? 😊`,
            ],
            [`あ、少し休憩していました！戻りました！☕`, `はい！少し休んでいましたが、戻りました。何でしょう？`],
            [`啊，刚去倒了杯咖啡。回来了！☕`, `在的！刚休息了一下，有什么事吗？`],
          ),
          lang,
        );
      if (intent.greeting)
        return pickL(
          l(
            [
              `Hi! I was on a quick break. How can I help? ☕`,
              `Hey! ${name} here. Was taking a breather. What's going on?`,
            ],
            [
              `Hi! I was on a quick break. How can I help? ☕`,
              `Hey! ${name} here. Was taking a breather. What's going on?`,
            ],
            [`こんにちは！少し休憩中でした。何でしょう？☕`],
            [`你好！我刚在休息。有什么事吗？☕`],
          ),
          lang,
        );
      return pickL(
        l(
          [
            `Oh, I was taking a break! Let me check right away 😅`,
            `Got it! Break's over, I'll look into it now!`,
            `I'm back! I'll handle that right away ☕`,
          ],
          [
            `Oh, I was taking a break! Let me check right away 😅`,
            `Got it! Break's over, I'll look into it now!`,
            `I'm back! I'll handle that right away ☕`,
          ],
          [`あ、休憩中でした！すぐ確認します 😅`, `戻りました！すぐ対応します ☕`],
          [`啊，刚在休息！马上看 😅`, `回来了！马上处理 ☕`],
        ),
        lang,
      );
    }

    if (agent.status === "working") {
      const taskKo = taskTitle ? ` "${taskTitle}" ` : "";
      const taskEn = taskTitle ? ` "${taskTitle}"` : " my current task";
      const taskJa = taskTitle ? ` "${taskTitle}"` : " 現在のタスク";
      const taskZh = taskTitle ? ` "${taskTitle}"` : " 当前任务";

      if (intent.presence)
        return pickL(
          l(
            [
              `Yes! I'm here. Currently working on${taskEn}. What do you need?`,
              `I'm at my desk! ${flair()} and making good progress 💻`,
              `Right here! Working on${taskEn}. What's up?`,
            ],
            [
              `Yes! I'm here. Currently working on${taskEn}. What do you need?`,
              `I'm at my desk! ${flair()} and making good progress 💻`,
              `Right here! Working on${taskEn}. What's up?`,
            ],
            [`はい！席にいます。${taskJa}を進行中です。何でしょう？`, `ここにいますよ！${flair()}頑張っています 💻`],
            [`在的！正在处理${taskZh}。有什么事？`, `我在工位上！正在${flair()} 💻`],
          ),
          lang,
        );
      if (intent.greeting)
        return pickL(
          l(
            [`Hi! ${nameTag} here. Currently ${flair()} 😊`, `Hello! I'm focused on${taskEn} right now, but go ahead!`],
            [`Hi! ${nameTag} here. Currently ${flair()} 😊`, `Hello! I'm focused on${taskEn} right now, but go ahead!`],
            [`こんにちは！${name}です。${flair()}作業中です 😊`],
            [`你好！${name}在这。正在${flair()} 😊`],
          ),
          lang,
        );
      if (intent.whatDoing)
        return pickL(
          l(
            [
              `Working on${taskEn} right now! ${flair()} — going smoothly 📊`,
              `I'm ${flair()} on${taskEn}. About 70% done!`,
              `Deep into${taskEn} at the moment. Should be done soon! 💪`,
            ],
            [
              `Working on${taskEn} right now! ${flair()} — going smoothly 📊`,
              `I'm ${flair()} on${taskEn}. About 70% done!`,
              `Deep into${taskEn} at the moment. Should be done soon! 💪`,
            ],
            [
              `${taskJa}を進行中です！${flair()}順調です 📊`,
              `${flair()}${taskJa}に取り組んでいます。もうすぐ完了です！💪`,
            ],
            [`正在处理${taskZh}！${flair()}进展顺利 📊`, `${flair()}处理${taskZh}中，大概完成70%了！💪`],
          ),
          lang,
        );
      if (intent.report)
        return pickL(
          l(
            [
              `${taskEn} is progressing well. ${flair()} — wrapping up! 📊`,
              `About 70% done on${taskEn}. On track for completion!`,
            ],
            [
              `${taskEn} is progressing well. ${flair()} — wrapping up! 📊`,
              `About 70% done on${taskEn}. On track for completion!`,
            ],
            [`${taskJa}は順調に進んでいます。${flair()}まもなく完了です！📊`],
            [`${taskZh}进展顺利。${flair()}快收尾了！📊`],
          ),
          lang,
        );
      if (intent.complaint)
        return pickL(
          l(
            [`Sorry about that! I'll pick up the pace 🏃‍♂️`, `Working as fast as I can! Just need a bit more time.`],
            [`Sorry about that! I'll pick up the pace 🏃‍♂️`, `Working as fast as I can! Just need a bit more time.`],
            [`申し訳ありません！最速で対応します 🏃‍♂️`],
            [`抱歉！我会加快速度 🏃‍♂️`],
          ),
          lang,
        );
      if (intent.canDo)
        return pickL(
          l(
            [
              `I'm tied up right now, but I'll jump on it as soon as I finish! 📝`,
              `Can do! Let me wrap up my current task first.`,
            ],
            [
              `I'm tied up right now, but I'll jump on it as soon as I finish! 📝`,
              `Can do! Let me wrap up my current task first.`,
            ],
            [`今は作業中ですが、完了後すぐ取りかかります！📝`],
            [`现在在忙，完成后马上开始！📝`],
          ),
          lang,
        );
      return pickL(
        l(
          [`Got it! I'll check after finishing my current task 📝`, `Noted! I'll get to it once I'm done here.`],
          [`Got it! I'll check after finishing my current task 📝`, `Noted! I'll get to it once I'm done here.`],
          [`了解しました！現在の作業完了後に確認します 📝`],
          [`收到！完成当前工作后确认 📝`],
        ),
        lang,
      );
    }

    if (intent.presence)
      return pickL(
        l(
          [
            `Yes, I'm here! ${nameTag}. What do you need? 😊`,
            `Right here! I was on standby. What's up?`,
            `I'm at my desk! Ready for anything.`,
            `Always ready! ${name} is here ✋`,
          ],
          [
            `Yes, I'm here! ${nameTag}. What do you need? 😊`,
            `Right here! I was on standby. What's up?`,
            `I'm at my desk! Ready for anything.`,
            `Always ready! ${name} is here ✋`,
          ],
          [
            `はい！席にいます。${name}です。何でしょう？😊`,
            `ここにいますよ！待機中でした。`,
            `席にいます！指示をお待ちしています ✋`,
          ],
          [`在的！${name}在这。有什么事吗？😊`, `我在！一直待命中。有什么需要？`, `随时准备就绪！${name}在这 ✋`],
        ),
        lang,
      );
    if (intent.greeting)
      return pickL(
        l(
          [
            `Hello! ${nameTag} here. Having a good day? 😊`,
            `Hi! ${nameTag}. Feel free to let me know if you need anything!`,
            `Hey! ${name} here. Let's make today count! 🔥`,
            `Good to see you! ${name} from ${dept}, ready to go!`,
          ],
          [
            `Hello! ${nameTag} here. Having a good day? 😊`,
            `Hi! ${nameTag}. Feel free to let me know if you need anything!`,
            `Hey! ${name} here. Let's make today count! 🔥`,
            `Good to see you! ${name} from ${dept}, ready to go!`,
          ],
          [
            `こんにちは！${name}です。今日もよろしくお願いします 😊`,
            `${name}です。何かあればお気軽にどうぞ！`,
            `今日も頑張りましょう！🔥`,
          ],
          [`你好！${name}在这。今天也加油！😊`, `${name}随时准备好了，有什么需要请说！🔥`],
        ),
        lang,
      );
    if (intent.whatDoing)
      return pickL(
        l(
          [
            `I'm on standby! Was ${flair()} to sharpen my skills 📚`,
            `Nothing assigned right now, so I was ${flair()}.`,
            `I'm free! Give me something to do and I'll jump right in 🙌`,
          ],
          [
            `I'm on standby! Was ${flair()} to sharpen my skills 📚`,
            `Nothing assigned right now, so I was ${flair()}.`,
            `I'm free! Give me something to do and I'll jump right in 🙌`,
          ],
          [`待機中です！${flair()}スキルアップしていました 📚`, `特に業務はないので、${flair()}個人学習中でした。`],
          [`待命中！正在${flair()}提升技能 📚`, `没有特别的任务，正在${flair()}学习中。`],
        ),
        lang,
      );
    if (intent.praise)
      return pickL(
        l(
          [
            `Thank you! I'll keep up the great work! 💪`,
            `That means a lot! I'll do my best 😊`,
            `Thanks! Really motivating to hear that ✨`,
          ],
          [
            `Thank you! I'll keep up the great work! 💪`,
            `That means a lot! I'll do my best 😊`,
            `Thanks! Really motivating to hear that ✨`,
          ],
          [`ありがとうございます！もっと頑張ります！💪`, `嬉しいです！最善を尽くします 😊`],
          [`谢谢！会继续努力的！💪`, `太开心了！会做到最好 😊`],
        ),
        lang,
      );
    if (intent.encourage)
      return pickL(
        l(
          [`Thanks! Your support means everything! 💪`, `You got it! I won't let you down 🔥`],
          [`Thanks! Your support means everything! 💪`, `You got it! I won't let you down 🔥`],
          [`ありがとうございます！頑張ります！💪`, `期待に応えます！🔥`],
          [`谢谢鼓励！一定不辜负期望！💪🔥`],
        ),
        lang,
      );
    if (intent.report)
      return pickL(
        l(
          [
            ``,
            ``,
          ],
          [
            `Currently on standby with no assigned tasks. Ready to start anything! 📋`,
            `I'm available! Just waiting for the next assignment.`,
          ],
          [`現在待機中で、割り当てタスクはありません。いつでも開始できます！📋`],
          [`目前待命中，没有分配任务。随时可以开始！📋`],
        ),
        lang,
      );
    if (intent.joke)
      return pickL(
        l(
          [
            `     ! 😄`,
            `    ~`,
            `😂    !    !`,
          ],
          [
            `Haha, you're in a good mood today! 😄`,
            `Love the vibes! Working with you is always fun~`,
            `😂 Good laugh! Alright, ready to get back to work!`,
          ],
          [`ハハ、今日はいい気分ですね！😄`, `😂 いい雰囲気！仕事に戻りましょう！`],
          [`哈哈，今天心情不错啊！😄`, `😂 笑完了，准备干活！`],
        ),
        lang,
      );
    if (intent.complaint)
      return pickL(
        l(
          [``, ``],
          [`Sorry about that! I'll step it up.`, `I hear you. I'll improve and show results! 🙏`],
          [`申し訳ありません！もっと速く動きます。`, `改善してお見せします！🙏`],
          [`抱歉！会加快行动。`, `记住了，会改进的！🙏`],
        ),
        lang,
      );
    if (intent.opinion)
      return pickL(
        l(
          [
            ``,
            ``,
            ``,
          ],
          [
            `From a ${dept} perspective, let me think about that... 🤔`,
            `Great question! Let me put together my thoughts on this.`,
            `Looks promising from where I sit. I'll analyze the details and get back to you 📊`,
          ],
          [`${dept}の観点から検討してみます！🤔`, `いい質問ですね！整理してお伝えします。`],
          [`从${dept}角度看，让我想想... 🤔`, `好问题！我整理一下想法再回复您 📊`],
        ),
        lang,
      );
    if (intent.canDo)
      return pickL(
        l(
          [
            `!    .   ! 🚀`,
            `, !     .`,
            `, ! ${name}()   💪`,
          ],
          [
            `Absolutely! I can start right away. Just give me the details! 🚀`,
            `Can do! I'm free right now, so I'll get on it.`,
            `Leave it to me! ${name} will handle it 💪`,
          ],
          [
            `もちろんです！すぐ始められます。詳細を教えてください！🚀`,
            `お任せください！${name}が責任持って対応します 💪`,
          ],
          [`当然可以！马上开始。请告诉我详情！🚀`, `交给我吧！${name}负责处理 💪`],
        ),
        lang,
      );
    if (intent.question)
      return pickL(
        l(
          [
            `!  🔍`,
            `,  .  !`,
            `     .`,
          ],
          [
            `Let me check on that! One moment 🔍`,
            `Good question! Let me look into it and get back to you.`,
            `I'll find out and get back to you ASAP.`,
          ],
          [`確認してみます！少々お待ちください 🔍`, `いい質問ですね。調べてお伝えします！`],
          [`让我查一下！稍等 🔍`, `好问题！我查查看。`],
        ),
        lang,
      );
    return pickL(
      l(
        [
          ``,
          ``,
          ``,
          ``,
        ],
        [
          `Got it! Let me know if you need anything else.`,
          `Understood! ${name} is on it 😊`,
          `Roger that! I'll get moving on this.`,
          `Noted! I'll take care of it 📝`,
        ],
        [
          `了解しました！他に必要なことがあればお知らせください。`,
          `承知しました！${name}が対応します 😊`,
          `かしこまりました！すぐ対応します 📝`,
        ],
        [`收到！有其他需要随时说。`, `明白了！${name}这就去办 😊`, `了解！马上处理 📝`],
      ),
      lang,
    );
  }

  return { generateChatReply };
}
