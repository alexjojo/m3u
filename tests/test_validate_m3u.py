import unittest
from tools.validate_m3u import validate


class ValidationTests(unittest.TestCase):
    def check(self, body):
        return validate('#EXTM3U\n' + body)

    def test_quoted_comma_and_backup(self):
        r = self.check('#EXTINF:-1 group-title="台灣,#genre#",頻道\nrtmp://host/a\n#EXTINF:-1,頻道\nhttps://host/b?k=1&t=2\n')
        self.assertEqual(r['errors'], [])
        self.assertEqual(r['unique_urls'], 2)

    def test_duplicate_whitespace(self):
        r = self.check('#EXTINF:-1,A\nhttps://host/a\n#EXTINF:-1,B\nhttps://host/a   \n')
        self.assertEqual(r['duplicate_groups'], 1)
        self.assertTrue(any('whitespace' in e for e in r['errors']))

    def test_missing_url_at_next_record_and_eof(self):
        r = self.check('#EXTINF:-1,A\n#EXTINF:-1,B\n')
        self.assertEqual(sum('missing stream' in e for e in r['errors']), 2)

    def test_invalid_metadata(self):
        for meta in ['#EXTINF:abc,A', '#EXTINF:-1 group-title="broken,A', '#EXTINF:-1,']:
            with self.subTest(meta=meta):
                self.assertTrue(self.check(meta+'\nhttps://host/a\n')['errors'])

    def test_invalid_urls(self):
        for url in ['relative.ts', 'http://', 'https://host:99999/a', 'https://host/a b']:
            with self.subTest(url=url):
                self.assertTrue(self.check('#EXTINF:-1,A\n'+url)['errors'])

    def test_header_and_orphan(self):
        for text in ['', '\ufeff#EXTM3U\n', '#EXTM3U\nhttps://host/a\n', '#EXTM3U\n#EXTM3U\n']:
            self.assertTrue(validate(text)['errors'])

    def test_crlf_and_extension(self):
        r = validate('#EXTM3U\r\n#EXTINF:-1,A\r\n#EXTVLCOPT:http-referrer=https://host/\r\nhttp://host/a\r\n')
        self.assertFalse(r['errors'])
        self.assertTrue(r['warnings'])


if __name__ == '__main__':
    unittest.main()
