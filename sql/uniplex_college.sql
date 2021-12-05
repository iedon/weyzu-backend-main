
SET FOREIGN_KEY_CHECKS=0;

-- ----------------------------
-- Table structure for classrooms
-- ----------------------------
DROP TABLE IF EXISTS `classrooms`;
CREATE TABLE `classrooms` (
  `rid` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `campus` varchar(255) NOT NULL,
  `building` varchar(255) NOT NULL,
  `room` varchar(255) NOT NULL,
  `date` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`rid`),
  UNIQUE KEY `idx_classrooms` (`campus`,`building`,`room`) USING BTREE,
  KEY `idx_campus` (`campus`) USING BTREE,
  KEY `idx_building` (`building`) USING BTREE,
  KEY `idx_room` (`room`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for clubs
-- ----------------------------
DROP TABLE IF EXISTS `clubs`;
CREATE TABLE `clubs` (
  `club_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `parent` int(10) unsigned DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `logo` varchar(255) DEFAULT NULL,
  `detail` text,
  PRIMARY KEY (`club_id`),
  UNIQUE KEY `idx_name` (`name`) USING BTREE,
  KEY `idx_parent` (`parent`) USING BTREE,
  CONSTRAINT `parent_clubs` FOREIGN KEY (`parent`) REFERENCES `clubs` (`club_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for contact
-- ----------------------------
DROP TABLE IF EXISTS `contact`;
CREATE TABLE `contact` (
  `contact_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `parent` int(10) unsigned DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `detail` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`contact_id`),
  UNIQUE KEY `idx_name` (`name`) USING BTREE,
  KEY `idx_parent` (`parent`) USING BTREE,
  CONSTRAINT `parent_contacts` FOREIGN KEY (`parent`) REFERENCES `contact` (`contact_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for courses
-- ----------------------------
DROP TABLE IF EXISTS `courses`;
CREATE TABLE `courses` (
  `cid` varchar(64) NOT NULL,
  `name` varchar(255) NOT NULL,
  `credit` varchar(32) NOT NULL,
  `date` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`cid`),
  KEY `idx_cid` (`cid`) USING BTREE,
  KEY `idx_name` (`name`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for schedules
-- ----------------------------
DROP TABLE IF EXISTS `schedules`;
CREATE TABLE `schedules` (
  `sid` varchar(32) NOT NULL,
  `cid` varchar(64) NOT NULL,
  `cindex` varchar(32) NOT NULL,
  `type` varchar(255) NOT NULL,
  `teacher` varchar(64) DEFAULT NULL,
  `weeks` varchar(64) NOT NULL,
  `day` tinyint(3) unsigned NOT NULL,
  `tid` tinyint(3) unsigned NOT NULL,
  `period` tinyint(3) unsigned NOT NULL,
  `rid` int(10) unsigned NOT NULL,
  `date` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`sid`,`cid`,`cindex`,`weeks`,`day`,`tid`,`period`),
  KEY `idx_cid` (`cid`) USING BTREE,
  KEY `idx_rid` (`rid`) USING BTREE,
  KEY `idx_sid` (`sid`) USING BTREE,
  KEY `idx_teacher` (`teacher`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for scores
-- ----------------------------
DROP TABLE IF EXISTS `scores`;
CREATE TABLE `scores` (
  `sid` varchar(32) NOT NULL,
  `cid` varchar(64) NOT NULL,
  `cindex` varchar(32) NOT NULL,
  `score` varchar(32) DEFAULT NULL,
  `term` varchar(255) NOT NULL,
  `type` varchar(255) NOT NULL,
  `comment` text,
  `date` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`sid`,`cid`,`cindex`),
  KEY `idx_cid` (`cid`) USING BTREE,
  KEY `idx_sid` (`sid`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for sessions
-- ----------------------------
DROP TABLE IF EXISTS `sessions`;
CREATE TABLE `sessions` (
  `uid` int(10) unsigned NOT NULL,
  `session` text,
  `date` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for students
-- ----------------------------
DROP TABLE IF EXISTS `students`;
CREATE TABLE `students` (
  `sid` varchar(32) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(64) NOT NULL,
  `sex` tinyint(4) NOT NULL,
  `year` varchar(32) DEFAULT NULL,
  `faculty` varchar(255) DEFAULT NULL,
  `major` varchar(255) DEFAULT NULL,
  `class` varchar(255) DEFAULT NULL,
  `sfz` varchar(255) DEFAULT NULL,
  `date` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`sid`),
  UNIQUE KEY `idx_sid` (`sid`) USING BTREE,
  KEY `idx_name` (`name`) USING BTREE,
  KEY `idx_class` (`class`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for timetable
-- ----------------------------
DROP TABLE IF EXISTS `timetable`;
CREATE TABLE `timetable` (
  `tid` int(10) unsigned NOT NULL,
  `begin` varchar(255) NOT NULL,
  `end` varchar(255) NOT NULL,
  `date` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`tid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for post_categories
-- ----------------------------
DROP TABLE IF EXISTS `post_categories`;
CREATE TABLE `post_categories` (
  `pcid` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `comment` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`pcid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for posts
-- ----------------------------
DROP TABLE IF EXISTS `posts`;
CREATE TABLE `posts` (
  `pid` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `pcid` int(10) unsigned NOT NULL,
  `uid` int(10) unsigned NOT NULL,
  `source` varchar(255) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `content` mediumtext NOT NULL,
  `date` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`pid`),
  KEY `idx_pcid` (`pcid`) USING BTREE,
  KEY `idx_title` (`title`) USING BTREE,
  KEY `idx_date` (`date`) USING BTREE,
  KEY `idx_uid` (`uid`) USING BTREE,
  CONSTRAINT `pcid_news` FOREIGN KEY (`pcid`) REFERENCES `post_categories` (`pcid`) ON DELETE CASCADE ON UPDATE CASCADE
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

-- ----------------------------
-- Table structure for bindings
-- ----------------------------
DROP TABLE IF EXISTS `bindings`;
CREATE TABLE `bindings` (
  `uid` int(10) unsigned NOT NULL,
  `sid` varchar(32) NOT NULL,
  `date` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`uid`,`sid`),
  UNIQUE KEY `idx_uid` (`uid`) USING BTREE,
  KEY `idx_sid` (`sid`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Records of settings
-- ----------------------------
INSERT INTO `settings`(`key`, `value`) VALUES('ENABLE_SWIPER', '1');
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_INTERVAL_MS', '5000');
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_MAIN_IMG', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_MAIN_PID', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_MAIN_TYPE', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_MAIN_URL', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_MAIN_APPID', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_1_IMG', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_1_PID', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_1_TYPE', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_1_URL', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_1_APPID', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_2_IMG', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_2_PID', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_2_TYPE', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_2_URL', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_2_APPID', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_3_IMG', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_3_PID', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_3_TYPE', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_3_URL', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_3_APPID', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_4_IMG', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_4_PID', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_4_TYPE', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_4_URL', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_4_APPID', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_5_IMG', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_5_PID', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_5_TYPE', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_5_URL', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('SWIPER_5_APPID', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('INFO_PAGE', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('CURRENT_WEEK', 1);
INSERT INTO `settings`(`key`, `value`) VALUES('NOTICE_TEXT', NULL);
INSERT INTO `settings`(`key`, `value`) VALUES('MAINTENANCE_TEXT', NULL);