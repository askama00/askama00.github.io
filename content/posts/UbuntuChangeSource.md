---
title: "Ubuntu更换apt源"
description: "这是本站的第一篇文章哦~"
date: 2026-08-22
lastmod: 2026-08-22
categories:
  - 随笔
tags:
  - 随笔
tocStartLevel: 3
tocEndLevel: 4
---

`Ubuntu`现在默认的软件源地址就比较快速，默认的地址不是`Ubuntu`应该就是`清华源`，但是作者比较喜欢更换为`阿里源`来使用，我们在`Ubuntu24.04`及以下版本可以使用软件工具中的软件和更新工具来自动检测合适的源并进行更换，更换完之后需要重新载入或执行`sudo apt update`来刷新源，但是`Ubuntu26.04`默认已经移除了该工具，这里提供一种命令换源的方式，系统版本以`Ubuntu24.04+`为例，老版本在文件位置上或略有不同。

执行如下命令打开Ubuntu镜像源配置文件（作者喜欢使用nano终端文件编辑工具，大家可以使用vi或vim或者vscode等进行编辑）：

    sudo nano /etc/apt/sources.list.d/ubuntu.sources

该命令使用的是nano文本编辑器，可以根据个人习惯使用不同的文本编辑器。

打开之后，将以下文本添加到配置文件的首选位置

    # aliyun mirror
    Types: deb
    URIs: http://mirrors.aliyun.com/ubuntu/
    Suites: noble noble-updates noble-security
    Components: main restricted universe multiverse
    Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg

如果阿里云比较慢，可以使用华为镜像源

    # huawei mirror
    Types: deb
    URIs: https://repo.huaweicloud.com/ubuntu/
    Suites: noble noble-updates noble-security
    Components: main restricted universe multiverse
    Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg

如果该配置文件以前没有修改过，那么添加后将以下截图所示（此处以WSL2的Ubuntu为例）：

![](/postsimg/img1.png)
添加之后，保存配置文件，然后使用如下命令，更新apt仓库源

    sudo apt update

如果更新成功，则换源成功。

