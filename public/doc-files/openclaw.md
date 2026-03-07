![OpenClaw](/docsPhoto/OpenClaw/OpenClaw.webp)
想要知道如何实现属于自己的🦞24/7私人助手吗，甚至实现云端项目本地协同管理，仅需几步就能部署在自己的云端服务器💻上（全程无广，不卖课）

（这里以阿里云和千文模型来演示，不配置小飞机等国外及国内频道，优先使用web端，核心思路是配置好AI后，其余一切 配置让AI解决）

1.拥有自己的服务器（已有服务器的可以跳过）
浏览器搜索阿里云进入官网，注册账号，点击上面菜单栏的产品，找到ECS云服务器
![AliCloud](/docsPhoto/OpenClaw/AliCloud.webp)

选择购买产品，建议购买包年包月（如果只想体验可以选择，按量付费，新人有99一年的ecs）配置必须在2核2G以上，系统随意选择，建议centOs，密钥设置可以在创建后使用
![AliCloud2](/docsPhoto/OpenClaw/AliCloud2.webp)

2.购买后右上角打开控制台，设置好相关密码后，点击远程连接，通过workbench远程连接,可以看到上方已经有一件部署openclaw了，但是可以不使用这个安装命令，阿里的安装命令限制比较多，这里给出官方的安装命令

curl -sSL https://openclaw.ai/install.sh | bash（这个命令可能会安装失败，时间等待过长，导致内存溢出，这时候可以使用阿里的国内镜像一键安装openclaw核心，但只需要安装就好，其余配置使用官方命令）

推荐安装宝塔面板实现可视化文件管理和终端，方便后期配置，这里给出centos的安装命令

url=https://download.bt.cn/install/install_p

anel.sh;if [ -f /usr/bin/curl ];then curl -sSO $url;else wget -O install_panel.sh $url;fi;bash install_panel.sh ed8484bec
![AliCloud3](/docsPhoto/OpenClaw/AliCloud3.webp)
![WorkBench](/docsPhoto/OpenClaw/WorkBench.webp)

3.首先确保自己有node环境，可以使用命令 node --version验证，如果没有自行安装nvm，通过nvm安装node（网上一搜就有）

安装完成后输入命令 openclaw onboard，进入

![install](/docsPhoto/OpenClaw/install.webp)

4.然后根据此图片选项选择（模型在配置文件修改，之所以不选择官方提供的ai选项是因为大部分要不了几秒，免费的token就消耗完了）

![result](/docsPhoto/OpenClaw/result.webp)

配置
5.接下来只需要配置好大模型Api就可以直接使用了，如果安装好了宝塔面板，登录自己的用户即可进入web页面，找到左侧的文件选项，找到openclaw的根目录里的openclaw.json，路径通常在/root/.openclaw里，双击打开然后编辑该配置文件，这里需要你提供模型的api和base url，这里以千问为例，因为openclaw的token消耗量很大，千问在百炼平台有7.9每月的CodingPlan计划（不是广告，你用其他家也可以），对于新手来说是量大管饱，

![BaoTa](/docsPhoto/OpenClaw/BaoTa.webp)

宝塔
这里提供华北服务器的千问base url

![url](/docsPhoto/OpenClaw/url.webp)
填写这两个时要注意千万不要搞错了
base url（华北，美国，新加坡）的区域和api的区别（普通api和CodingPlan套餐是不一样的）

![url2](/docsPhoto/OpenClaw/url2.webp)

复制全选替换即可（api和base url要注意替换）


![config](/docsPhoto/OpenClaw/config.webp)

6.配置好后可以直接在宝塔面板中打开终端，输入以下命令 openclaw doctor（一键诊断命令）检查是否有错误,如果提示里没有error，就说明配置成功了，运行此命令检查网关是否启动 openclaw gateway status，默认已在运行，可以查看以下图片，运行在18789端口

![gateway](/docsPhoto/OpenClaw/gateway.webp)

7.完成后使用命令 openclaw tui就可以在终端进行对话了

![tui](/docsPhoto/OpenClaw/tui.webp)

8.当然了，终端对话显得太过简陋了，但是服务器又不在身边，有没有可视化界面怎么进入web后端呢，答案是通过ssh的方式，远程通过本机访问云端的web后台

这里给出步骤

1.首先你的本机需要一个ssh key，如果没有创建一个（命令网上都有）

2.使用宝塔面板或命令将ssh key上传到你的服务

器这个目录~/.ssh/authorized_keys（如果没有.ssh目录，手动创建）

3.完成后，在本机终端输入以下命令 ssh -N -L 18789:localhost:18789 root@你的服务器IP （注意运行后不要关闭终端） 

4.打开浏览器，输入以下地址 127.0.0.1:18789 就能使用了

![web](/docsPhoto/OpenClaw/web.webp)

Web
接下来如果想接入小飞机，Message，钉钉等等，直接将你的需求告诉配置好的Ai，他会一步一步教你，或者直接在配置文件中进行配置，如果接入国外的产品，则需要配置网络代理，这里不多说了，如果遇到失败等等，多参考官方文档，也可以在底下评论，我会帮你解答
![docs](/docsPhoto/OpenClaw/docs.webp)

后续还会推出更多关于MCP skill的相关教程，点个赞不迷路，电一电