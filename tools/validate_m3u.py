#!/usr/bin/env python3
"""Offline Extended M3U checks; never contacts stream servers or edits files."""
import argparse
import re
import sys
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlsplit


def split_info(line):
    quoted = False
    for i, char in enumerate(line):
        if char == '"':
            quoted = not quoted
        elif char == ',' and not quoted:
            return line[:i], line[i + 1:]
    raise ValueError('missing separator comma or unclosed quote')


def validate(text):
    errors, warnings, entries = [], [], []
    lines = text.splitlines()
    if not lines or not re.fullmatch(r'#EXTM3U(?:\s+.*)?', lines[0]):
        errors.append('line 1: expected #EXTM3U header (UTF-8 without BOM)')
    pending = None
    for number, raw in enumerate(lines, 1):
        line = raw.strip()
        if raw != line:
            errors.append(f'line {number}: leading/trailing whitespace')
        if any(ord(c) < 32 and c != '\t' for c in raw):
            errors.append(f'line {number}: control character')
        if not line:
            continue
        if line.startswith('#EXTM3U'):
            if number != 1:
                errors.append(f'line {number}: repeated/misplaced header')
            continue
        if line.startswith('#EXTINF'):
            if pending:
                errors.append(f'line {pending}: missing stream URL')
            pending = number
            try:
                meta, name = split_info(line)
                if not name.strip():
                    raise ValueError('empty channel name')
                if not re.fullmatch(r'#EXTINF:-?\d+(?:\.\d+)?(?:\s+[\w-]+="[^"\r\n]*")*\s*', meta):
                    raise ValueError('invalid duration or attribute syntax')
            except ValueError as exc:
                errors.append(f'line {number}: {exc}')
            continue
        if line.startswith('#'):
            if line.startswith('#EXT'):
                warnings.append(f'line {number}: extension directive not validated')
            continue
        if pending is None:
            errors.append(f'line {number}: stream URL without #EXTINF')
        else:
            entries.append((pending, number, line))
            pending = None
        try:
            url = urlsplit(line)
            if not url.scheme or not url.netloc or not url.hostname or re.search(r'\s', line):
                raise ValueError('expected absolute network URL without whitespace')
            _ = url.port
            if url.scheme.lower() not in {'http', 'https', 'rtmp', 'rtmps', 'rtsp', 'rtsps', 'udp', 'rtp'}:
                warnings.append(f'line {number}: protocol support requires player verification')
        except ValueError as exc:
            errors.append(f'line {number}: invalid stream URL ({exc})')
    if pending:
        errors.append(f'line {pending}: missing stream URL')
    if not entries:
        errors.append('playlist contains no stream records')
    urls = defaultdict(list)
    for _, number, url in entries:
        urls[url].append(number)
    duplicates = [numbers for numbers in urls.values() if len(numbers) > 1]
    for numbers in duplicates:
        errors.append('duplicate URL at lines ' + ', '.join(map(str, numbers)))
    return {'records': len(entries), 'unique_urls': len(urls),
            'duplicate_groups': len(duplicates), 'errors': errors, 'warnings': warnings}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('playlist', nargs='?', default='taiwan.m3u', type=Path)
    args = parser.parse_args()
    try:
        result = validate(args.playlist.read_text(encoding='utf-8'))
    except (OSError, UnicodeError) as exc:
        print(f'ERROR: {exc}', file=sys.stderr)
        return 2
    print(f"Static only: {result['records']} records, {result['unique_urls']} unique URLs, {result['duplicate_groups']} duplicate groups")
    for severity in ('errors', 'warnings'):
        for message in result[severity]:
            print(f'{severity.upper()}: {message}')
    print('Playback: NOT TESTED')
    return 1 if result['errors'] else 0


if __name__ == '__main__':
    sys.exit(main())
