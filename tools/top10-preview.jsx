import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Top10 from '../src/modules/top10/Top10';
import ForgeMaxExtractor from '../src/modules/forge-max/pages/ForgeMaxExtractor';
createRoot(document.getElementById('root')).render(<BrowserRouter><Routes>
  <Route path="/the-forge-max" element={<ForgeMaxExtractor />} />
  <Route path="*" element={<Top10 />} />
</Routes></BrowserRouter>);
