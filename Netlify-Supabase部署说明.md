# Netlify + Supabase 部署说明

本项目已经改成 Netlify 静态页面 + Netlify Functions 后端 + Supabase 云数据库的部署结构。

## 一、已经新增的文件

- `netlify.toml`：Netlify 构建、发布目录、API 转发配置。
- `netlify/functions/api.js`：云端后端接口，替代本地 `server.js` 的 SQLite 接口。
- `supabase/schema.sql`：Supabase 建表和测试数据脚本。
- `scripts/build.js`：部署时只复制 HTML 和 `app.js` 到 `dist`，避免公开本地数据库和启动脚本。
- `.env.example`：环境变量示例。

## 二、Supabase 建数据库

1. 打开 https://supabase.com/ 并登录。
2. 新建 Project。
3. 进入项目后，打开左侧 `SQL Editor`。
4. 新建 Query。
5. 打开本项目的 `supabase/schema.sql`，复制全部内容。
6. 粘贴到 Supabase SQL Editor，点击 `Run`。
7. 进入 `Project Settings` -> `API Keys`。
8. 复制 `Project URL`，后面填到 Netlify 的 `SUPABASE_URL`。
9. 复制 `Secret key`，后面填到 Netlify 的 `SUPABASE_SECRET_KEY`。

注意：`SUPABASE_SECRET_KEY` 或 legacy `service_role` key 只能放在 Netlify 环境变量里，不能写进 HTML 或 `app.js`。

## 三、Netlify 部署

推荐方式：把本项目上传到 GitHub，然后在 Netlify 选择 `Add new project` -> `Import an existing project`。

Netlify 读取到本项目的 `netlify.toml` 后，会自动使用：

```txt
Build command: node scripts/build.js
Publish directory: dist
Functions directory: netlify/functions
```

然后在 Netlify 项目中进入：

```txt
Project configuration -> Environment variables
```

添加下面 4 个变量：

```txt
SUPABASE_URL=你的 Supabase Project URL
SUPABASE_SECRET_KEY=你的 Supabase Secret key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123456
```

保存后重新部署一次。

如果不用 GitHub，也可以用 Netlify CLI：

```powershell
npm install -g netlify-cli
netlify login
netlify init
netlify env:set SUPABASE_URL "你的 Supabase Project URL"
netlify env:set SUPABASE_SECRET_KEY "你的 Supabase Secret key"
netlify env:set ADMIN_USERNAME "admin"
netlify env:set ADMIN_PASSWORD "admin123456"
netlify deploy --build --prod
```

不要只把 `dist` 文件夹拖到 Netlify。这个项目有后端接口，必须让 Netlify 一起部署 `netlify/functions/api.js`。

## 四、部署成功后访问

Netlify 会生成一个类似下面的网址：

```txt
https://你的项目名.netlify.app/
```

用户端首页：

```txt
https://你的项目名.netlify.app/
```

管理员入口：

```txt
https://你的项目名.netlify.app/管理员登录界面.html
```

管理员账号：

```txt
admin
```

管理员密码：

```txt
admin123456
```

普通测试账号：

```txt
zhangsan / 123456
lisi / 123456
wangwu / 123456
```

## 五、检查接口是否正常

部署后打开：

```txt
https://你的项目名.netlify.app/api/health
```

如果返回：

```json
{"success":true,"message":"Netlify Functions 运行正常","database":"Supabase"}
```

说明 Netlify 后端和 Supabase 数据库已经连接成功。

## 六、常见错误

如果页面能打开，但列表加载失败：

1. 检查 Netlify 环境变量是否填错。
2. 检查 Supabase 是否已经执行 `supabase/schema.sql`。
3. 检查是否把 `SUPABASE_SECRET_KEY` 写成了 publishable/anon key。
4. 重新点 Netlify 的 `Trigger deploy` -> `Deploy site`。

如果 `/api/health` 提示环境变量未配置：

说明 Netlify 没有读取到 `SUPABASE_URL` 或 `SUPABASE_SECRET_KEY`，重新添加环境变量后再部署。

## 七、官方文档

- Netlify 部署说明：https://docs.netlify.com/deploy/create-deploys/
- Netlify 环境变量说明：https://docs.netlify.com/build/configure-builds/environment-variables/
- Supabase API Keys 说明：https://supabase.com/docs/guides/api/api-keys
- Supabase 数据库说明：https://supabase.com/docs/guides/database
