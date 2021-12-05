
SET FOREIGN_KEY_CHECKS=0;

-- ----------------------------
-- Table structure for accounts
-- ----------------------------
SET sql_mode='NO_AUTO_VALUE_ON_ZERO';
DROP TABLE IF EXISTS `accounts`;
CREATE TABLE `accounts` (
  `uid` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `gid` int(10) unsigned NOT NULL,
  `user` varchar(128) NOT NULL,
  `password` varchar(128) DEFAULT NULL,
  `salt` varchar(128) DEFAULT NULL,
  `name` varchar(128) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(32) DEFAULT NULL,
  `reg_date` datetime DEFAULT NULL,
  `reg_ip` varchar(128) DEFAULT NULL,
  `last_login` datetime DEFAULT NULL,
  `last_ip` varchar(128) DEFAULT NULL,
  PRIMARY KEY (`uid`),
  UNIQUE KEY `idx_accounts` (`gid`,`user`) USING BTREE,
  KEY `idx_gid` (`gid`) USING BTREE,
  KEY `idx_user` (`user`) USING BTREE,
  KEY `idx_name` (`name`) USING BTREE,
  KEY `idx_reg_date` (`reg_date`) USING BTREE,
  KEY `idx_reg_ip` (`reg_ip`) USING BTREE,
  KEY `idx_last_login` (`last_login`) USING BTREE,
  KEY `idx_last_ip` (`last_ip`) USING BTREE,
  CONSTRAINT `gid_accounts` FOREIGN KEY (`gid`) REFERENCES `groups` (`gid`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8mb4;
INSERT INTO `accounts`(`uid`, `gid`, `user`, `password`, `name`, `reg_date`, `last_login`) VALUES(0, 0, 'root', '$2a$10$54bTHqFHNZtjqH.IRvqYxeu7hUTHCFOPIq/IsomTmFe8kqTya5ozK', '超级管理员', now(), now());
INSERT INTO `accounts`(`gid`, `user`, `name`, `reg_date`, `last_login`) VALUES(0, 'newsbot', '新闻小助手', now(), now());

-- ----------------------------
-- Table structure for account_bans
-- ----------------------------
DROP TABLE IF EXISTS `account_bans`;
CREATE TABLE `account_bans` (
  `uid` int(10) unsigned NOT NULL,
  `reason` text,
  `date` datetime NOT NULL ON UPDATE CURRENT_TIMESTAMP,
  `release` datetime DEFAULT NULL,
  PRIMARY KEY (`uid`),
  CONSTRAINT `uid_account_bans` FOREIGN KEY (`uid`) REFERENCES `accounts` (`uid`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for colleges
-- ----------------------------
SET sql_mode='strict_trans_tables';
DROP TABLE IF EXISTS `colleges`;
CREATE TABLE `colleges` (
  `college_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `college_name` varchar(255) NOT NULL,
  `system_type` varchar(255) NOT NULL,
  `system_url` varchar(255) NOT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `captcha` tinyint(3) unsigned zerofill NOT NULL,
  `db_server` varchar(255) NOT NULL,
  `db_port` varchar(10) NOT NULL,
  `db_user` varchar(255) NOT NULL,
  `db_password` varchar(255) NOT NULL,
  `db_name` varchar(255) NOT NULL,
  `wx_appid` varchar(255) DEFAULT NULL,
  `wx_secret` varchar(255) DEFAULT NULL,
  `qq_appid` varchar(255) DEFAULT NULL,
  `qq_secret` varchar(255) DEFAULT NULL,
  `comment` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`college_id`),
  UNIQUE KEY `idx_college_name` (`college_name`) USING BTREE,
  KEY `idx_wx_appid` (`wx_appid`) USING BTREE,
  KEY `idx_qq_appid` (`qq_appid`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for groups
-- ----------------------------
SET sql_mode='NO_AUTO_VALUE_ON_ZERO';
DROP TABLE IF EXISTS `groups`;
CREATE TABLE `groups` (
  `gid` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `comment` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`gid`),
  UNIQUE KEY `idx_name` (`name`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8mb4;
INSERT INTO `groups`(`gid`, `name`, `comment`) VALUES(0, '系统组', '系统超级管理用户');
INSERT INTO `groups`(`name`, `comment`) VALUES('默认组', '普通用户');
INSERT INTO `groups`(`name`, `comment`) VALUES('管理组', '普通管理帐户，分管各个院校');
INSERT INTO `groups`(`name`, `comment`) VALUES('微信小程序用户', '通过 微信小程序 OAuth 开放平台认证注册的用户');
INSERT INTO `groups`(`name`, `comment`) VALUES('QQ小程序用户', '通过 QQ小程序 OAuth 开放平台认证注册的用户');

-- ----------------------------
-- Table structure for maps
-- ----------------------------
SET sql_mode='strict_trans_tables';
DROP TABLE IF EXISTS `maps`;
CREATE TABLE `maps` (
  `uid` int(10) unsigned NOT NULL,
  `college_id` int(10) unsigned NOT NULL,
  `date` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`uid`),
  UNIQUE KEY `idx_uid` (`uid`) USING BTREE,
  KEY `idx_college_id` (`college_id`) USING BTREE,
  CONSTRAINT `college_id_maps` FOREIGN KEY (`college_id`) REFERENCES `colleges` (`college_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `uid_maps` FOREIGN KEY (`uid`) REFERENCES `accounts` (`uid`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for oauth
-- ----------------------------
SET sql_mode='strict_trans_tables';
DROP TABLE IF EXISTS `oauth`;
CREATE TABLE `oauth` (
  `uid` int(10) unsigned NOT NULL,
  `openid` varchar(255) DEFAULT NULL,
  `unionid` varchar(255) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `avatar` varchar(255) DEFAULT NULL,
  `gender` varchar(255) DEFAULT NULL,
  `language` varchar(255) DEFAULT NULL,
  `country` varchar(255) DEFAULT NULL,
  `province` varchar(255) DEFAULT NULL,
  `city` varchar(255) DEFAULT NULL,
  `date` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`uid`),
  UNIQUE KEY `idx_uid` (`uid`) USING BTREE,
  CONSTRAINT `uid_oauth` FOREIGN KEY (`uid`) REFERENCES `accounts` (`uid`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for settings
-- ----------------------------
DROP TABLE IF EXISTS `settings`;
CREATE TABLE `settings` (
  `key` varchar(255) NOT NULL,
  `value` text,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO `settings`(`key`, `value`) VALUES('NAME', 'iEdon Uniplex');
INSERT INTO `settings`(`key`, `value`) VALUES('VERSION', '2.0.0');
INSERT INTO `settings`(`key`, `value`) VALUES('COPYRIGHT', '© 2019 iEdon');
INSERT INTO `settings`(`key`, `value`) VALUES('ACCOUNT_GID', '1');
INSERT INTO `settings`(`key`, `value`) VALUES('ACCOUNT_GID_OAUTH_WX', '3');
INSERT INTO `settings`(`key`, `value`) VALUES('ACCOUNT_GID_OAUTH_QQ', '4');

-- ----------------------------
-- Table structure for metadata
-- ----------------------------
DROP TABLE IF EXISTS `metadata`;
CREATE TABLE `metadata` (
  `uid` int(10) unsigned NOT NULL,
  `meta_key` varchar(255) NOT NULL,
  `meta_value` text CHARACTER SET utf8mb4,
  PRIMARY KEY (`uid`,`meta_key`),
  KEY `idx_uid` (`uid`) USING BTREE,
  KEY `idx_meta_key` (`meta_key`) USING BTREE,
  CONSTRAINT `uid_metadata` FOREIGN KEY (`uid`) REFERENCES `accounts` (`uid`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
