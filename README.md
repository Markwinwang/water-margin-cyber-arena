# Water Margin Cyber Arena

一个以《水浒传》一百单八将为主题的中文赛博风互动站点，保留现代前端架构，同时把数据、视觉和对战内容全部切换成梁山世界观。

## 技术栈

- Next.js 16
- React + TypeScript
- Tailwind CSS
- Framer Motion
- Three.js + React Three Fiber + Drei

## 功能

- 3D 将星主舞台：使用 React Three Fiber 展示当前选中的梁山头领
- 梁山名册：支持卡片、表格、星宿阵图三种视图
- 108 将本地数据：含姓名、绰号、天罡/地煞、营职、兵器、战力标签
- 点将对决：玩家与 AI 各点 3 将，使用冲阵、结阵、绝技进行回合制交锋
- 本地图片资源：站内自动生成 108 张将星 SVG 图，不依赖外部素材库

## 本地运行

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 生产构建

```bash
npm run build
npm run start
```
