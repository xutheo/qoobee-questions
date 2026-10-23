import unittest
from app import dates,match,images,run_search
USER='123456789012345678'
class PickerTests(unittest.TestCase):
    def msg(self,n=1,**kwargs):
        return dict(id=str(n),author={'id':USER},timestamp='2026-10-20T23:59:59Z',content='A sufficiently long quote '+str(n),**kwargs)
    def test_dates_and_length(self):
        a,b=dates('2026-10-20','2026-10-20')
        self.assertTrue(match(self.msg(),USER,a,b,'quote',4,'words'))
        self.assertFalse(match(self.msg(),USER,a,b,'quote',100,'characters'))
        self.assertFalse(match(self.msg(),'different',a,b,'quote',0,'words'))
        with self.assertRaises(ValueError):dates('2026-10-21','2026-10-20')
    def test_image_only(self):
        m=self.msg(attachments=[{'content_type':'image/png','url':'https://example.com/a.png'}]);m['content']=''
        a,b=dates('2026-10-20','2026-10-20')
        self.assertTrue(match(m,USER,a,b,'post',0,'characters'))
        self.assertFalse(match(m,USER,a,b,'post',1,'characters'))
        self.assertFalse(match(m,USER,a,b,'quote',0,'characters'))
    def test_all_matches(self):
        batch=[self.msg(i) for i in range(12)]
        class Fake:
            def get(self,path,params=None):
                return {'user':{'username':'tester'}} if '/members/' in path else batch
        job={};run_search(Fake(),'guild',[{'id':'channel','name':'test'}],{'user':USER,'start':'2026-10-20','end':'2026-10-20','mode':'quote'},job)
        self.assertEqual(job['status'],'done');self.assertEqual(job['matched'],12);self.assertEqual(len(job['results']),12)
        self.assertEqual(len({r['messageId'] for r in job['results']}),12)
if __name__=='__main__':unittest.main()
