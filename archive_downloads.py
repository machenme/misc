#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
智能文件归档系统 - 精简版
逻辑：文件 -> 日 (YYYY-MM-DD) -> 月 (YYYY-MM)
去除了周归档逻辑，使层级更扁平。
"""

import os
import shutil
import logging
import re
from datetime import datetime
from pathlib import Path

# ==================== 用户配置区域 ====================
SOURCE_DIR = r"C:\Users\chen\Downloads"
LOG_TO_FILE = True
# =====================================================

def setup_logging():
    log_format = '%(asctime)s - %(levelname)s - %(message)s'
    handlers = [logging.StreamHandler()]
    if LOG_TO_FILE:
        # 日志存放在目标目录的上一级，避免日志文件也被归档
        log_path = Path(SOURCE_DIR).parent / "archive_manager_simple.log"
        handlers.append(logging.FileHandler(log_path, encoding='utf-8'))
    logging.basicConfig(level=logging.INFO, format=log_format, handlers=handlers)
    return logging.getLogger("ArchiveExpert")

logger = setup_logging()

def is_archive_folder(name):
    """正则匹配识别归档文件夹：匹配 YYYY-MM-DD 或 YYYY-MM"""
    return bool(re.match(r"^\d{4}-\d{2}(-\d{2})?$", name))

def organize_files_to_day(source_path, today):
    """步骤 1: 将散落的文件/文件夹按修改时间移入对应的 YYYY-MM-DD 文件夹"""
    for item in source_path.iterdir():
        # 排除隐藏文件、日志文件和已经识别为归档目录的文件夹
        if item.name.startswith('.') or "archive_manager" in item.name:
            continue
        if item.is_dir() and is_archive_folder(item.name):
            continue
            
        # 获取修改日期
        mtime = datetime.fromtimestamp(item.stat().st_mtime).date()
        
        # 规则：不处理今天刚修改的项目，避免干扰正在工作的任务
        if mtime >= today:
            continue

        day_str = mtime.strftime("%Y-%m-%d")
        day_path = source_path / day_str
        day_path.mkdir(exist_ok=True)
        
        target = day_path / item.name
        if not target.exists():
            try:
                shutil.move(str(item), str(target))
                logger.info(f"[日归档] {item.name} -> {day_str}")
            except Exception as e:
                logger.error(f"移动失败 {item.name}: {e}")

def organize_days_to_month(source_path, today):
    """步骤 2: 扫描所有日文件夹(YYYY-MM-DD)，将其移入对应的月文件夹(YYYY-MM)"""
    for item in source_path.iterdir():
        # 仅匹配 YYYY-MM-DD 格式的文件夹
        if item.is_dir() and re.match(r"^\d{4}-\d{2}-\d{2}$", item.name):
            try:
                parts = item.name.split('-')
                year_val, month_val = parts[0], parts[1]
                
                # 规则：只归档“过去月份”的文件夹
                # 如果是当月的日期文件夹，保留在根目录，方便近期查找
                if int(year_val) < today.year or (int(year_val) == today.year and int(month_val) < today.month):
                    month_str = f"{year_val}-{month_val}"
                    month_path = source_path / month_str
                    month_path.mkdir(exist_ok=True)
                    
                    shutil.move(str(item), str(month_path / item.name))
                    logger.info(f"[月封存] {item.name} -> {month_str}")
            except Exception as e:
                logger.error(f"月封存错误 {item.name}: {e}")

def main():
    source_path = Path(SOURCE_DIR)
    if not source_path.exists():
        logger.error(f"路径不存在: {SOURCE_DIR}")
        return

    today = datetime.now().date()
    logger.info(f"=== 启动精简版归档程序 (目标: {SOURCE_DIR}) ===")

    # 执行逻辑：先入日，再入月
    organize_files_to_day(source_path, today)
    organize_days_to_month(source_path, today)

    logger.info("=== 归档任务执行完毕 ===")

if __name__ == "__main__":
    main()
