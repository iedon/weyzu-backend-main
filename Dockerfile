FROM node:lts-slim

MAINTAINER iEdon <m@iedon.net>
LABEL package="weyzu-ms-main" version="2.0.6" description="《We歪字优》主服务端微服务容器"

ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

RUN mkdir /stuff
RUN chmod 755 -R /stuff

WORKDIR /stuff
ADD package.json /stuff/package.json

RUN npm i --production --registry=https://registry.npm.taobao.org

# RUN npm audit fix

ADD . /stuff/
EXPOSE 15000
ENTRYPOINT ["npm", "start"]
