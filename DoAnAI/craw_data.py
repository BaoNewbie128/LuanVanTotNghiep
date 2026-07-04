from icrawler.builtin import GoogleImageCrawler
from icrawler.builtin import BingImageCrawler

def crawl(name, folder):
    crawler = BingImageCrawler(storage={'root_dir': folder})
    crawler.crawl(keyword=name, max_num=100)

# Crawl dữ liệu
crawl("NISSAN 350Z", "dataset/train/350z")
crawl("TOYOTA AE86 TRUENO", "dataset/train/ae86_trueno")
crawl("HONDA CIVIC EG6", "dataset/train/civic_eg6")
crawl("NISSAN GTR R34", "dataset/train/gtr_r34")
crawl("NISSAN GTR R35", "dataset/train/gtr_r35")
crawl("SUBARU IMPREZA WRX", "dataset/train/impreza")
crawl("MITSUBISHI LANCER EVO VI", "dataset/train/lancer_evo_VI")
crawl("HONDA NSX", "dataset/train/nsx")
crawl("MAZDA RX7 FC", "dataset/train/rx7_fc")
crawl("MAZDA RX7 FD", "dataset/train/rx7_fd")
crawl("HONDA S2000", "dataset/train/s2000")
crawl("NISSAN SILVIA S15", "dataset/train/silvia_s15")
crawl("TOYOTA SUPRA MK4", "dataset/train/supra_mk4")
crawl("TOYOTA SUPRA MK5", "dataset/train/supra_mk5")

