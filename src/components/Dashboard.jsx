import { useState, useRef } from 'react';
import './Dashboard.css';
import logo from '../assets/dn.png';
import bgImage from '../assets/background.png';
import robotImg from '../assets/robot.png';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [resultTab, setResultTab] = useState('diagnostic');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  
  const [isPdfUploading, setIsPdfUploading] = useState(false);
  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  const handleImageUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(URL.createObjectURL(e.target.files[0]));
      setAnalysisResult(null); // Reset previous results on new upload
    }
  };

  const handlePdfUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      setIsPdfUploading(true);
      setTimeout(() => {
        setIsPdfUploading(false);
        alert(`Le document "${e.target.files[0].name}" a été ingéré par l'IA DermaNova avec succès !`);
      }, 2500);
    }
  };

  const startAnalysis = () => {
    if (!selectedImage) {
      alert("Veuillez d'abord importer une photo.");
      return;
    }
    setAnalysisResult(null);
    setResultTab('diagnostic');
    setIsAnalyzing(true);
    
    // Simuler le délai d'analyse
    setTimeout(() => {
      setIsAnalyzing(false);
      setAnalysisResult({
        hydration: '78.4%',
        ph: '5.51',
        elasticity: '68%',
        aging: {
          bioAge: '34 ans',
          wrinkles: 'Légères',
          collagenLoss: '12%',
          details: "Excellente préservation du derme. Les micro-ridules correspondent au vieillissement naturel sans signe de photovieillissement accéléré."
        },
        diagnosis: "Analyse croisée avec 142 ouvrages terminée. Léger déficit d'hydratation épidermique localisé. Aucune anomalie pigmentaire atypique.",
        recommendation: "Prescription suggérée : Sérum antioxydant + Émollient riche en céramides."
      });
    }, 3000);
  };

  const tabs = [
    { id: 'dashboard', label: 'Tableau de bord' },
    { id: 'patients', label: 'Liste Patients' },
    { id: 'pdf_knowledge', label: 'Connaissances PDF' },
    { id: 'settings', label: 'Paramètres' },
  ];

  // Le Scanner combiné
  const renderScannerCard = () => (
    <div className="unified-scanner-card animate-fade-in">
      <div className="card-header">
        <h2>ANALYSE <span className="brand-light">DERMATOLOGIQUE</span></h2>
      </div>
      <p className="card-description">
        Importez ou prenez une photo directe. Le robot assistant croisera les données avec la littérature mondiale.
      </p>
      
      <div className="scanner-body">
        
        {/* Colonne 1: Uploader compact */}
        <div className="upload-column glass-panel">
          <div className="upload-container compact" onClick={() => fileInputRef.current.click()}>
            {selectedImage ? (
              <div className="uploaded-image-wrapper">
                <img src={selectedImage} alt="Scan preview" className="uploaded-image" />
                {isAnalyzing && <div className="scan-laser"></div>}
              </div>
            ) : (
              <div className="upload-placeholder">
                <div className="upload-icon-ring">
                  <span className="upload-icon">📷</span>
                </div>
                <h3>Photo</h3>
                <span className="upload-subtext">Caméra ou Galerie</span>
              </div>
            )}
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleImageUpload} 
            />
          </div>
          {selectedImage && (
            <div className="upload-actions">
              <button className="change-photo-btn" onClick={() => fileInputRef.current.click()}>
                📸 Changer de photo
              </button>
              <button className="save-patient-btn" onClick={() => alert("Ouverture du formulaire de création de patient...")}>
                💾 Enregistrer ce(tte) patient(e)
              </button>
            </div>
          )}
        </div>

        {/* Colonne 2: Résultats de l'analyse */}
        <div className="results-column glass-panel">
          {isAnalyzing ? (
            <div className="analyzing-state">
              <div className="spinner"></div>
              <p className="scanning-text">Consultation de la littérature mondiale en cours...</p>
            </div>
          ) : analysisResult ? (
            <div className="analysis-results animate-fade-in">
              <div className="result-tabs">
                <button 
                  className={`result-tab ${resultTab === 'diagnostic' ? 'active' : ''}`}
                  onClick={() => setResultTab('diagnostic')}
                >
                  DIAGNOSTIC
                </button>
                <button 
                  className={`result-tab ${resultTab === 'traitement' ? 'active' : ''}`}
                  onClick={() => setResultTab('traitement')}
                >
                  TRAITEMENT
                </button>
              </div>

              {resultTab === 'diagnostic' && (
                <div className="tab-content animate-fade-in">
                  <h3 className="results-title">RÉSULTATS BIOMÉTRIQUES</h3>
                  <div className="metrics-grid">
                    <div className="metric-box">
                      <span className="metric-label">HYDRATATION</span>
                      <span className="metric-value">{analysisResult.hydration}</span>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label">PH DERMIQUE</span>
                      <span className="metric-value">{analysisResult.ph}</span>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label">ÉLASTICITÉ</span>
                      <span className="metric-value">{analysisResult.elasticity}</span>
                    </div>
                  </div>
                  
                  <div className="aging-analysis">
                    <h4>VIEILLISSEMENT CUTANÉ</h4>
                    <div className="aging-stats">
                      <div className="aging-stat"><span>Âge Biologique</span><strong>{analysisResult.aging.bioAge}</strong></div>
                      <div className="aging-stat"><span>Rides & Ridules</span><strong>{analysisResult.aging.wrinkles}</strong></div>
                      <div className="aging-stat"><span>Perte Collagène</span><strong>{analysisResult.aging.collagenLoss}</strong></div>
                    </div>
                    <p className="aging-details">{analysisResult.aging.details}</p>
                  </div>

                  <div className="ai-diagnosis">
                    <h4>DIAGNOSTIC CLINIQUE</h4>
                    <p>{analysisResult.diagnosis}</p>
                  </div>
                </div>
              )}

              {resultTab === 'traitement' && (
                <div className="tab-content animate-fade-in">
                  <div className="ai-recommendation">
                    <h4>RECOMMANDATIONS IA</h4>
                    <p>{analysisResult.recommendation}</p>
                  </div>
                  <div className="treatment-details">
                    <h4>ROUTINE SUGGÉRÉE</h4>
                    <ul>
                      <li><strong>Matin :</strong> Nettoyant doux, Sérum antioxydant (Vitamine C), Écran solaire SPF 50+.</li>
                      <li><strong>Soir :</strong> Démaquillage hydratant, Émollient riche en céramides sur les zones identifiées.</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="waiting-state">
              <span className="waiting-icon">🔬</span>
              <p>L'analyse détaillée du patient apparaîtra ici.</p>
            </div>
          )}
        </div>

        {/* Colonne 3: Robot & CTA */}
        <div className={`robot-side glass-panel ${isAnalyzing ? 'scanning-active' : ''}`}>
          <div className="robot-dialogue">
            <p>
              {isAnalyzing 
                ? "Recherche de correspondances cliniques..." 
                : analysisResult
                  ? "Analyse terminée ! Consultez le rapport détaillé."
                  : selectedImage 
                    ? "Image reçue ! Prêt à croiser les données." 
                    : "Bonjour Dr. Malon ! Je suis prêt."}
            </p>
          </div>
          <img src={robotImg} alt="DermaNova Assistant Robot" className={`robot-image ${isAnalyzing ? 'floating' : ''}`} />
          <button 
            className={`start-analysis-btn ${isAnalyzing ? 'analyzing' : ''} ${analysisResult ? 'success' : ''}`} 
            onClick={startAnalysis}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? "ANALYSE EN COURS..." : analysisResult ? "NOUVELLE ANALYSE" : "DÉMARRER L'ANALYSE"}
          </button>
        </div>
      </div>
    </div>
  );

  const renderPatientsList = () => (
    <div className="content-card animate-fade-in">
      <div className="card-header">
        <h2>LISTE DES <span className="brand-light">PATIENTS</span></h2>
        <button className="premium-btn-small">Nouveau Patient</button>
      </div>
      <p className="card-description">
        Sélectionnez un patient pour accéder à son dossier complet et ses analyses. Classés du plus récent au plus ancien.
      </p>
      
      <div className="patients-list glass-panel" style={{padding: '2rem'}}>
        <div className="patient-list-item">
          <div className="patient-avatar-small">J</div>
          <div className="patient-info-row">
            <h3>Juliette R.</h3>
            <span className="patient-age">19 ans</span>
          </div>
          <div className="patient-date">Aujourd'hui</div>
          <span className="status-badge improving">En amélioration</span>
          <button className="view-btn-icon">➔</button>
        </div>

        <div className="patient-list-item">
          <div className="patient-avatar-small">S</div>
          <div className="patient-info-row">
            <h3>Sophie L.</h3>
            <span className="patient-age">32 ans</span>
          </div>
          <div className="patient-date">Il y a 2 jours</div>
          <span className="status-badge warning">Analyse prioritaire</span>
          <button className="view-btn-icon">➔</button>
        </div>

        <div className="patient-list-item">
          <div className="patient-avatar-small">M</div>
          <div className="patient-info-row">
            <h3>Marc D.</h3>
            <span className="patient-age">45 ans</span>
          </div>
          <div className="patient-date">Il y a 1 mois</div>
          <span className="status-badge stable">Stable</span>
          <button className="view-btn-icon">➔</button>
        </div>
      </div>
    </div>
  );

  const renderPdfKnowledge = () => (
    <div className="content-card animate-fade-in">
      <div className="card-header">
        <h2>CONNAISSANCES <span className="brand-light">PDF & IA</span></h2>
      </div>
      <p className="card-description">
        Alimentez le cerveau de DermaNova. Importez des ouvrages internationaux et des publications scientifiques pour affiner la précision des diagnostics de l'assistant robot.
      </p>

      <div className="pdf-knowledge-layout">
        <div className="pdf-upload-section glass-panel-glow" onClick={() => pdfInputRef.current.click()}>
          <div className="upload-icon-ring pdf-icon">
            <span className="upload-icon">📄</span>
          </div>
          <h3>Importer un Ouvrage (PDF)</h3>
          <p>L'IA lira et intégrera ces connaissances instantanément</p>
          <input 
            type="file" 
            accept=".pdf" 
            ref={pdfInputRef} 
            style={{ display: 'none' }} 
            onChange={handlePdfUpload} 
          />
          {isPdfUploading && <p className="uploading-text">Ingestion par l'IA en cours...</p>}
        </div>

        <div className="pdf-library">
          <h3>Ouvrages ingérés récents</h3>
          <ul className="library-list">
            <li className="library-item glass-panel">
              <span className="book-icon">📚</span>
              <div className="book-info">
                <h4>Fitzpatrick's Dermatology, 9th Edition</h4>
                <span>Base de données internationale • Traité à 100%</span>
              </div>
            </li>
            <li className="library-item glass-panel">
              <span className="book-icon">📚</span>
              <div className="book-info">
                <h4>Dermatology - Bolognia (Vol 1 & 2)</h4>
                <span>Atlas clinique • Traité à 100%</span>
              </div>
            </li>
            <li className="library-item glass-panel">
              <span className="book-icon">🔬</span>
              <div className="book-info">
                <h4>Journal of Investigative Dermatology - 2025</h4>
                <span>Publications récentes • Traité à 100%</span>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="glass-panel content-card animate-fade-in">
      <div className="card-header">
        <h2>PARAMÈTRES <span className="brand-light">SYSTÈME</span></h2>
      </div>
      <p className="card-description">
        Configurez votre clinique et l'intelligence artificielle de DermaNova.
      </p>

      <div className="settings-grid">
        <div className="setting-group glass-panel">
          <h3>Préférences de l'Assistant Robot</h3>
          <label className="setting-toggle">
            <span>Analyse biométrique de haute précision (plus lent)</span>
            <input type="checkbox" defaultChecked />
          </label>
          <label className="setting-toggle">
            <span>Prioriser la littérature récemment ajoutée (PDF)</span>
            <input type="checkbox" defaultChecked />
          </label>
        </div>

        <div className="setting-group glass-panel">
          <h3>Interface & Compte</h3>
          <label className="setting-toggle">
            <span>Mode sombre premium (Activé par défaut)</span>
            <input type="checkbox" defaultChecked disabled />
          </label>
          <div className="setting-action">
            <span>Clinique : Institut Dermatologique de Paris</span>
            <button className="premium-btn-small outline">Modifier</button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="dashboard-container" style={{ backgroundImage: `url(${bgImage})` }}>
      <div className="dashboard-overlay"></div>
      
      <div className="dashboard-layout">
        
        {/* Sidebar à gauche */}
        <aside className="main-sidebar glass-panel">
          <div className="sidebar-logo-container">
            <img src={logo} alt="DermaNova Logo" className="sidebar-logo" />
          </div>
          
          <nav className="sidebar-nav">
            {tabs.map(tab => (
              <button 
                key={tab.id}
                className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="user-profile">
              <div className="user-avatar-placeholder"></div>
              <div className="user-info">
                <span className="user-name">Dr. Malon</span>
                <span className="user-role">Dermatologue</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Contenu principal */}
        <div className="dashboard-content">
          <main className="dashboard-main full-height">
            {activeTab === 'dashboard' && (
              <div className="dashboard-grid layout-single">
                {renderScannerCard()}
              </div>
            )}
            
            {activeTab === 'patients' && (
              <div className="layout-single">
                {renderPatientsList()}
              </div>
            )}

            {activeTab === 'pdf_knowledge' && (
              <div className="layout-single">
                {renderPdfKnowledge()}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="layout-single">
                {renderSettings()}
              </div>
            )}
          </main>
        </div>
        
      </div>
    </div>
  );
}
