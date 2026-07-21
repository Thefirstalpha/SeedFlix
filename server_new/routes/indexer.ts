import { Router } from "express";
import { authentication } from "../modules/auth";
import { IndexerSettings } from "../../common/settings";
import { configureIndexer, getIndexerSettings, getMoviesIndexerResult, getSeriesIndexerResult, searchMovieIndexer, searchSeriesIndexer } from "../modules/indexer";
import { IndexerMovieResponse, IndexerSeriesResponse } from "../../common/indexer";

const router = Router();
router.use(authentication);


router.get('/indexer/configure', async (req, res) => {
    const userId = req.user.id;
    let indexerSettings = await getIndexerSettings(userId);
    if (indexerSettings && 'token' in indexerSettings) 
        delete indexerSettings.token;
    
    res.status(200).json(indexerSettings);
});


router.post('/indexer/configure', async (req, res) => {
    if (!req.body) {
        res.status(400).json({ error: 'Request body is required' });
        return;
    }
    const setting: IndexerSettings = {
        url: String(req.body?.url || '').trim(),
        token: String(req.body?.token || '').trim(),
        qualities: Array.isArray(req.body?.qualities) ? req.body.qualities.map(String) : [],
        languages: Array.isArray(req.body?.languages) ? req.body.languages.map(String) : [],
    }
    await configureIndexer(req.user.id, setting);
    res.status(200).json({ message: 'Indexer settings configured successfully' });
});

router.get('/indexer/search/movies/:id', async (req, res) => {
    const id = Number(req.params.id);
    const limit = Number(req.query.limit) || 100;
    const offset = Number(req.query.offset) || 0;
    const items = await searchMovieIndexer(req.user.id, id, limit, offset);
    const data : IndexerMovieResponse = {
        ok: true,
        items: items,
    }
    res.status(200).json(data);
});



router.get('/indexer/search/series/:id', async (req, res) => {
    const id = Number(req.params.id);
    const limit = Number(req.query.limit) || 100;
    const offset = Number(req.query.offset) || 0;
    const season = req.query.season;

    const items = await searchSeriesIndexer(req.user.id, id, limit, offset, season);
    const data : IndexerSeriesResponse = {
        ok: true,
        items: items,
    }
    res.status(200).json(data);
});


router.get('/indexer/results/movies', async (req, res) => {
    const items = await getMoviesIndexerResult(req.user.id);
    res.status(200).json({
        ok: true,
        items: items,
    });
});
router.get('/indexer/results/series', async (req, res) => {
    const items = await getSeriesIndexerResult(req.user.id);
    res.status(200).json({
        ok: true,
        items: items,
    });
});

export { router };